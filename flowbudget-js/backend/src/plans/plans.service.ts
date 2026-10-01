import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager, In, Not } from 'typeorm';
import { toAccountDto, type AccountDto } from '../accounts/accounts.js';
import { type DateStr, monthStart, today } from '../common/dates.js';
import { badRequest, conflict } from '../common/errors.js';
import { effectiveVersions, upcomingVersion } from '../common/versioning.js';
import { Account, DailyExpense, DivisionPlan, Expenditure, Pocket } from '../database/entities/index.js';
import { BudgetService } from '../domain/budget.service.js';
import { OwnershipService } from '../domain/ownership.service.js';

export interface PocketDto {
  id: string;
  lineageId: string;
  planId: string;
  name: string;
  ration: number;
  activeFrom: string;
  upcoming: { name: string; ration: number; activeFrom: string; isDeleted: boolean } | null;
}

export interface PlanDto {
  id: string;
  name: string;
  isActive: boolean;
  isCurrent: boolean;
  activeFrom: string | null;
  account: AccountDto;
  pockets: PocketDto[];
}

export const currentMonth = () => monthStart(today());

// The month whose pocket versions are shown for a plan: the current month, or the activation month of a plan scheduled for later.
export function referenceMonth(plan: DivisionPlan): DateStr {
  const now = currentMonth();
  return plan.isActive && plan.activeFrom && plan.activeFrom > now ? plan.activeFrom : now;
}

export function pocketsAt(rows: Pocket[], month: DateStr): PocketDto[] {
  return effectiveVersions(rows, month).map((p) => {
    const next = upcomingVersion(
      rows.filter((r) => r.lineageId === p.lineageId),
      month,
    );
    return {
      id: p.id,
      lineageId: p.lineageId,
      planId: p.planId,
      name: p.name,
      ration: p.ration,
      activeFrom: p.activeFrom,
      upcoming: next ? { name: next.name, ration: next.ration, activeFrom: next.activeFrom, isDeleted: next.isDeleted } : null,
    };
  });
}

@Injectable()
export class PlansService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ownership: OwnershipService,
    private readonly budget: BudgetService,
  ) {}

  async list(userId: string, accountId: string): Promise<PlanDto[]> {
    const em = this.dataSource.manager;
    const account = await this.ownership.account(userId, accountId);
    const plans = await em.find(DivisionPlan, { where: { accountId }, order: { createdAt: 'ASC' } });
    const current = await this.budget.effectivePlan(em, accountId, currentMonth());
    const pockets = plans.length ? await em.find(Pocket, { where: { planId: In(plans.map((p) => p.id)) } }) : [];

    return plans.map((plan) =>
      this.toDto(
        plan,
        account,
        plan.id === current?.id,
        pocketsAt(
          pockets.filter((p) => p.planId === plan.id),
          referenceMonth(plan),
        ),
      ),
    );
  }

  async effective(userId: string, accountId: string, date: DateStr): Promise<{ plan: PlanDto | null }> {
    const em = this.dataSource.manager;
    const account = await this.ownership.account(userId, accountId);
    const month = monthStart(date);
    const plan = await this.budget.effectivePlan(em, accountId, month);
    if (!plan) return { plan: null };
    const current = await this.budget.effectivePlan(em, accountId, currentMonth());
    const pockets = await em.find(Pocket, { where: { planId: plan.id } });
    return { plan: this.toDto(plan, account, plan.id === current?.id, pocketsAt(pockets, month)) };
  }

  async create(userId: string, accountId: string, name: string): Promise<{ id: string }> {
    await this.ownership.account(userId, accountId);
    const plan = await this.dataSource.getRepository(DivisionPlan).save({ accountId, name: name.trim() });
    return { id: plan.id };
  }

  async rename(userId: string, id: string, name: string): Promise<void> {
    await this.ownership.plan(userId, id);
    await this.dataSource.getRepository(DivisionPlan).update({ id }, { name: name.trim() });
  }

  // Without another active plan a plan can start in the current month; otherwise only from next month on,
  // because moving the current month's bookkeeping between plans is not supported.
  async activate(userId: string, id: string, from: DateStr): Promise<void> {
    const now = currentMonth();
    if (from < now) throw badRequest('cannot_change_past_months');

    await this.dataSource.transaction(async (em) => {
      const plan = await this.ownership.plan(userId, id, em);
      if (plan.isActive) throw conflict('plan_already_active');

      const otherActive = await em.existsBy(DivisionPlan, { accountId: plan.accountId, isActive: true, id: Not(id) });
      if (otherActive && from <= now) throw conflict('another_plan_active_this_month');

      const stale = await this.dailyExpensesOfOtherPlans(em, plan.accountId, id, from);
      if (stale.length > 0) {
        const hasExpenditures = await em.existsBy(Expenditure, { dailyExpenseId: In(stale) });
        if (hasExpenditures) throw conflict('cannot_activate_with_existing_expenditures');
        await em.delete(DailyExpense, { id: In(stale) });
      }

      await em.update(DivisionPlan, { id }, { isActive: true, activeFrom: from });
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      await this.ownership.plan(userId, id, em);
      const hasHistory = await em
        .createQueryBuilder(DailyExpense, 'de')
        .innerJoin('de.pocket', 'pocket')
        .where('pocket.planId = :id', { id })
        .getExists();
      if (hasHistory) throw conflict('cannot_delete_plan_with_history');
      await em.delete(DivisionPlan, { id });
    });
  }

  private async dailyExpensesOfOtherPlans(em: EntityManager, accountId: string, planId: string, from: DateStr): Promise<string[]> {
    const rows = await em
      .createQueryBuilder(DailyExpense, 'de')
      .select('de.id', 'id')
      .innerJoin('de.pocket', 'pocket')
      .innerJoin('pocket.plan', 'plan')
      .where('plan.accountId = :accountId AND plan.id <> :planId AND de.date >= :from', { accountId, planId, from })
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  private toDto(plan: DivisionPlan, account: Account, isCurrent: boolean, pockets: PocketDto[]): PlanDto {
    return {
      id: plan.id,
      name: plan.name,
      isActive: plan.isActive,
      isCurrent,
      activeFrom: plan.activeFrom,
      account: toAccountDto(account),
      pockets,
    };
  }
}
