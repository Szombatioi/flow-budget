import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager, In, MoreThan, MoreThanOrEqual } from 'typeorm';
import { type DateStr, monthStart } from '../common/dates.js';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { effectiveVersion, effectiveVersions, upcomingVersion } from '../common/versioning.js';
import { DailyExpense, DivisionPlan, Pocket } from '../database/entities/index.js';
import { BudgetService } from '../domain/budget.service.js';
import { OwnershipService } from '../domain/ownership.service.js';
import { currentMonth, pocketsAt, type PocketDto, referenceMonth } from './plans.service.js';

const RATIO_EPSILON = 0.001;

@Injectable()
export class PocketsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ownership: OwnershipService,
    private readonly budget: BudgetService,
  ) {}

  async list(userId: string, planId: string): Promise<PocketDto[]> {
    const plan = await this.ownership.plan(userId, planId);
    return pocketsAt(await this.dataSource.manager.find(Pocket, { where: { planId } }), referenceMonth(plan));
  }

  async create(userId: string, planId: string, dto: { name: string; ration: number; from?: DateStr }): Promise<{ id: string }> {
    return this.dataSource.transaction(async (em) => {
      const plan = await this.ownership.plan(userId, planId, em);
      const month = this.changeMonth(plan, dto.from);
      await this.assertRatio(em, planId, month, dto.ration);

      const id = randomUUID();
      await em.insert(Pocket, { id, lineageId: id, planId, name: dto.name.trim(), ration: dto.ration, activeFrom: month });

      const months: { month: string }[] = await em.query(
        `SELECT DISTINCT to_char(date_trunc('month', de.date), 'YYYY-MM-DD') AS month
         FROM daily_expenses de JOIN pockets p ON p.id = de."pocketId"
         WHERE p."planId" = $1 AND de.date >= $2`,
        [planId, month],
      );
      for (const row of months) {
        await this.budget.ensureMonth(em, plan.accountId, row.month);
        await this.budget.recalculatePocketMonth(em, id, row.month);
      }
      return { id };
    });
  }

  async update(userId: string, id: string, dto: { name?: string; ration?: number; from?: DateStr }): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const pocket = await this.ownership.pocket(userId, id, em);
      if (dto.name !== undefined) await em.update(Pocket, { lineageId: pocket.lineageId }, { name: dto.name.trim() });
      if (dto.ration === undefined || dto.ration === pocket.ration) return;

      const month = this.changeMonth(pocket.plan, dto.from);
      await this.assertRatio(em, pocket.planId, month, dto.ration, pocket.lineageId);
      await this.upsertVersion(em, pocket, month, () => dto.ration!);
      await this.budget.reassignLineage(em, pocket.lineageId, month);
      await this.budget.recalculateLineageFrom(em, pocket.lineageId, month);
    });
  }

  /*
   * A pocket without bookkeeping is simply deleted. Otherwise its lineage is ended from the current month:
   * past months keep their history, while the current and future days (with their expenditures) are merged
   * into the target pocket, which also takes over the deleted pocket's ratio.
   */
  async remove(userId: string, id: string, targetPocketId?: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const pocket = await this.ownership.pocket(userId, id, em);
      const versions = await em.find(Pocket, { where: { lineageId: pocket.lineageId } });
      const versionIds = versions.map((v) => v.id);

      if (!(await em.existsBy(DailyExpense, { pocketId: In(versionIds) }))) {
        await em.delete(Pocket, { lineageId: pocket.lineageId });
        return;
      }

      const month = currentMonth();
      const target = await this.resolveTarget(em, pocket.planId, pocket.lineageId, month, targetPocketId);
      const targetVersions = await em.find(Pocket, { where: { lineageId: target.lineageId } });

      const toMove = await em.find(DailyExpense, { where: { pocketId: In(versionIds), date: MoreThanOrEqual(month) } });
      for (const de of toMove) {
        const owner = effectiveVersion(targetVersions, monthStart(de.date)) ?? target;
        await this.budget.moveDailyExpense(em, de, owner.id);
      }

      const movedRation = (effectiveVersion(versions, month) ?? upcomingVersion(versions, month))?.ration ?? 0;
      await em.delete(Pocket, { lineageId: pocket.lineageId, activeFrom: MoreThanOrEqual(month) });
      if (await em.existsBy(Pocket, { lineageId: pocket.lineageId })) {
        await em.insert(Pocket, { id: randomUUID(), lineageId: pocket.lineageId, planId: pocket.planId, name: pocket.name, ration: 0, activeFrom: month, isDeleted: true });
      }

      if (movedRation > 0) {
        await this.upsertVersion(em, target, month, (current) => current + movedRation);
        for (const later of await em.find(Pocket, { where: { lineageId: target.lineageId, activeFrom: MoreThan(month), isDeleted: false } })) {
          await em.update(Pocket, { id: later.id }, { ration: later.ration + movedRation });
        }
      }

      await this.budget.reassignLineage(em, target.lineageId, month);
      await this.budget.recalculateLineageFrom(em, target.lineageId, month);
    });
  }

  // Changes of an active plan apply from the chosen month; a plan that is not in use yet is edited "from now".
  private changeMonth(plan: DivisionPlan, from?: DateStr): DateStr {
    const now = currentMonth();
    if (!plan.isActive) return now;
    const month = from ?? referenceMonth(plan);
    if (month < now) throw badRequest('cannot_change_past_months');
    return month;
  }

  private async assertRatio(em: EntityManager, planId: string, month: DateStr, ration: number, excludeLineageId?: string) {
    const rows = await em.find(Pocket, { where: { planId } });
    const others = effectiveVersions(rows, month).filter((p) => p.lineageId !== excludeLineageId);
    const total = others.reduce((acc, p) => acc + p.ration, 0) + ration;
    if (total > 100 + RATIO_EPSILON) throw badRequest('ratio_exceed_limit');
  }

  private async upsertVersion(em: EntityManager, pocket: Pocket, month: DateStr, ration: (current: number) => number) {
    const versions = await em.find(Pocket, { where: { lineageId: pocket.lineageId } });
    const base = effectiveVersion(versions, month) ?? pocket;
    const existing = versions.find((v) => v.activeFrom === month && !v.isDeleted);
    if (existing) {
      await em.update(Pocket, { id: existing.id }, { ration: ration(existing.ration) });
    } else {
      await em.insert(Pocket, { id: randomUUID(), lineageId: pocket.lineageId, planId: pocket.planId, name: base.name, ration: ration(base.ration), activeFrom: month });
    }
  }

  private async resolveTarget(em: EntityManager, planId: string, lineageId: string, month: DateStr, targetPocketId?: string): Promise<Pocket> {
    const candidates = effectiveVersions(await em.find(Pocket, { where: { planId } }), month).filter((p) => p.lineageId !== lineageId);
    if (candidates.length === 0) throw conflict('cannot_delete_last_pocket');

    if (targetPocketId) {
      const target = await em.findOneBy(Pocket, { id: targetPocketId });
      const match = target && candidates.find((c) => c.lineageId === target.lineageId);
      if (!match) throw notFound('pocket_not_found');
      return match;
    }

    const usage = await em
      .createQueryBuilder(DailyExpense, 'de')
      .select('de.pocketId', 'pocketId')
      .addSelect('COUNT(*)::int', 'count')
      .where('de.pocketId IN (:...ids) AND de.isStarted = true AND de.date >= :month', { ids: candidates.map((c) => c.id), month })
      .groupBy('de.pocketId')
      .orderBy('count', 'DESC')
      .getRawMany<{ pocketId: string }>();
    return candidates.find((c) => c.id === usage[0]?.pocketId) ?? candidates[0];
  }
}
