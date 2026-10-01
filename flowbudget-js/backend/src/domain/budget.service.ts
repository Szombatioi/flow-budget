import { Injectable } from '@nestjs/common';
import { Between, type EntityManager, In, LessThanOrEqual } from 'typeorm';
import { type DateStr, daysInMonth, daysOfMonth, monthEnd, monthStart, parts } from '../common/dates.js';
import { roundMoney, sumMoney } from '../common/money.js';
import { effectiveVersion, effectiveVersions } from '../common/versioning.js';
import { DailyExpense, DivisionPlan, Expenditure, FixedExpense, Income, Pocket } from '../database/entities/index.js';

type DistributableCache = Map<string, number>;

/*
 * Budget flow for an account and month:
 *  1. distributable money = effective incomes - effective fixed expenses
 *  2. every pocket of the effective division plan gets `ration`% of it, split evenly across the days
 *  3. each day's start amount = daily share + previous day's end-of-day amount (if that day is started)
 *  4. end-of-day amount = start amount - the day's expenditures
 * The carry-over chain restarts on the first day of every month.
 */
@Injectable()
export class BudgetService {
  async effectivePlan(em: EntityManager, accountId: string, month: DateStr): Promise<DivisionPlan | null> {
    return em
      .createQueryBuilder(DivisionPlan, 'plan')
      .where('plan.accountId = :accountId AND plan.isActive = true AND plan.activeFrom <= :month', { accountId, month })
      .orderBy('plan.activeFrom', 'DESC')
      .addOrderBy('plan.createdAt', 'DESC')
      .getOne();
  }

  async effectivePockets(em: EntityManager, planId: string, month: DateStr): Promise<Pocket[]> {
    const rows = await em.find(Pocket, { where: { planId, activeFrom: LessThanOrEqual(month) } });
    return effectiveVersions(rows, month);
  }

  async distributable(em: EntityManager, accountId: string, month: DateStr, cache?: DistributableCache): Promise<number> {
    const key = `${accountId}:${month}`;
    const cached = cache?.get(key);
    if (cached !== undefined) return cached;

    const where = { accountId, activeFrom: LessThanOrEqual(month) };
    const incomes = effectiveVersions(await em.find(Income, { where }), month);
    const fixed = effectiveVersions(await em.find(FixedExpense, { where }), month);
    const value = roundMoney(sumMoney(incomes.map((i) => i.amount)) - sumMoney(fixed.map((f) => f.amount)));
    cache?.set(key, value);
    return value;
  }

  dailyShare(distributable: number, ration: number, month: DateStr): number {
    const { y, m } = parts(month);
    return roundMoney((distributable * ration) / 100 / daysInMonth(y, m));
  }

  // Creates the missing daily expenses of a month for every pocket of the effective plan. Safe to call concurrently.
  async ensureMonth(em: EntityManager, accountId: string, date: DateStr): Promise<void> {
    const month = monthStart(date);
    const plan = await this.effectivePlan(em, accountId, month);
    if (!plan) return;
    const pockets = await this.effectivePockets(em, plan.id, month);
    if (pockets.length === 0) return;

    const days = daysOfMonth(month);
    const counts = await em
      .createQueryBuilder(DailyExpense, 'de')
      .select('de.pocketId', 'pocketId')
      .addSelect('COUNT(*)::int', 'count')
      .where('de.pocketId IN (:...ids) AND de.date BETWEEN :from AND :to', { ids: pockets.map((p) => p.id), from: month, to: monthEnd(month) })
      .groupBy('de.pocketId')
      .getRawMany<{ pocketId: string; count: number }>();
    const complete = new Set(counts.filter((c) => c.count >= days.length).map((c) => c.pocketId));
    const missing = pockets.filter((p) => !complete.has(p.id));
    if (missing.length === 0) return;

    const distributable = await this.distributable(em, accountId, month);
    const rows = missing.flatMap((pocket) => {
      const share = this.dailyShare(distributable, pocket.ration, month);
      return days.map((day) => ({ pocketId: pocket.id, date: day, startAmount: share, eodAmount: share, relativeBudget: share, isStarted: false }));
    });
    await em.createQueryBuilder().insert().into(DailyExpense).values(rows).orIgnore().execute();
  }

  // Recomputes the whole carry-over chain of a pocket's month. Days up to `activateUntil` are marked as started.
  async recalculatePocketMonth(
    em: EntityManager,
    pocketId: string,
    month: DateStr,
    options: { activateUntil?: DateStr; cache?: DistributableCache } = {},
  ): Promise<void> {
    const pocket = await em.findOne(Pocket, { where: { id: pocketId }, relations: { plan: true } });
    if (!pocket) return;

    const dailyExpenses = await em.find(DailyExpense, {
      where: { pocketId, date: Between(month, monthEnd(month)) },
      order: { date: 'ASC' },
    });
    if (dailyExpenses.length === 0) return;

    const spentRows = await em
      .createQueryBuilder(Expenditure, 'e')
      .select('e.dailyExpenseId', 'id')
      .addSelect('SUM(e.price)', 'spent')
      .where('e.dailyExpenseId IN (:...ids)', { ids: dailyExpenses.map((de) => de.id) })
      .groupBy('e.dailyExpenseId')
      .getRawMany<{ id: string; spent: string }>();
    const spent = new Map(spentRows.map((r) => [r.id, Number.parseFloat(r.spent)]));

    const distributable = await this.distributable(em, pocket.plan.accountId, month, options.cache);
    const share = this.dailyShare(distributable, pocket.ration, month);

    const changed: DailyExpense[] = [];
    let previous: DailyExpense | null = null;
    for (const de of dailyExpenses) {
      const before = `${de.startAmount}|${de.eodAmount}|${de.relativeBudget}|${de.isStarted}`;
      if (options.activateUntil && de.date <= options.activateUntil) de.isStarted = true;
      const carry = previous?.isStarted ? previous.eodAmount : 0;
      de.relativeBudget = share;
      de.startAmount = roundMoney(share + carry);
      de.eodAmount = roundMoney(de.startAmount - (spent.get(de.id) ?? 0));
      if (before !== `${de.startAmount}|${de.eodAmount}|${de.relativeBudget}|${de.isStarted}`) changed.push(de);
      previous = de;
    }

    if (changed.length === 0) return;
    const values = changed.map((_, i) => `($${i * 5 + 1}::uuid, $${i * 5 + 2}::numeric, $${i * 5 + 3}::numeric, $${i * 5 + 4}::numeric, $${i * 5 + 5}::boolean)`);
    await em.query(
      `UPDATE daily_expenses AS d
       SET "startAmount" = v.s, "eodAmount" = v.e, "relativeBudget" = v.r, "isStarted" = v.st
       FROM (VALUES ${values.join(', ')}) AS v(id, s, e, r, st)
       WHERE d.id = v.id`,
      changed.flatMap((de) => [de.id, de.startAmount, de.eodAmount, de.relativeBudget, de.isStarted]),
    );
  }

  async recalculateAccountFrom(em: EntityManager, accountId: string, fromMonth: DateStr): Promise<void> {
    const rows: { pocketId: string; month: string }[] = await em.query(
      `SELECT DISTINCT de."pocketId" AS "pocketId", to_char(date_trunc('month', de.date), 'YYYY-MM-DD') AS month
       FROM daily_expenses de
       JOIN pockets p ON p.id = de."pocketId"
       JOIN division_plans dp ON dp.id = p."planId"
       WHERE dp."accountId" = $1 AND de.date >= $2`,
      [accountId, fromMonth],
    );
    await this.recalculatePairs(em, rows);
  }

  async recalculateLineageFrom(em: EntityManager, lineageId: string, fromMonth: DateStr): Promise<void> {
    const rows: { pocketId: string; month: string }[] = await em.query(
      `SELECT DISTINCT de."pocketId" AS "pocketId", to_char(date_trunc('month', de.date), 'YYYY-MM-DD') AS month
       FROM daily_expenses de
       JOIN pockets p ON p.id = de."pocketId"
       WHERE p."lineageId" = $1 AND de.date >= $2`,
      [lineageId, fromMonth],
    );
    await this.recalculatePairs(em, rows);
  }

  async recalculatePairs(em: EntityManager, pairs: { pocketId: string; month: string }[]): Promise<void> {
    const cache: DistributableCache = new Map();
    const unique = new Map(pairs.map((p) => [`${p.pocketId}:${p.month}`, p]));
    for (const { pocketId, month } of unique.values()) await this.recalculatePocketMonth(em, pocketId, month, { cache });
  }

  // After pocket versions change, moves each daily expense (from `fromMonth` on) to the version effective in its month.
  async reassignLineage(em: EntityManager, lineageId: string, fromMonth: DateStr): Promise<void> {
    const versions = await em.find(Pocket, { where: { lineageId } });
    if (versions.length === 0) return;
    const dailyExpenses = await em
      .createQueryBuilder(DailyExpense, 'de')
      .where('de.pocketId IN (:...ids) AND de.date >= :fromMonth', { ids: versions.map((v) => v.id), fromMonth })
      .getMany();

    for (const de of dailyExpenses) {
      const owner = effectiveVersion(versions, monthStart(de.date));
      if (owner && owner.id !== de.pocketId) await this.moveDailyExpense(em, de, owner.id);
    }
  }

  async moveDailyExpense(em: EntityManager, de: DailyExpense, targetPocketId: string): Promise<void> {
    const target = await em.findOneBy(DailyExpense, { pocketId: targetPocketId, date: de.date });
    if (!target) {
      await em.update(DailyExpense, { id: de.id }, { pocketId: targetPocketId });
      return;
    }
    await em.update(Expenditure, { dailyExpenseId: de.id }, { dailyExpenseId: target.id });
    if (!target.wishlistId && de.wishlistId) await em.update(DailyExpense, { id: target.id }, { wishlistId: de.wishlistId });
    if (de.isStarted && !target.isStarted) await em.update(DailyExpense, { id: target.id }, { isStarted: true });
    await em.delete(DailyExpense, { id: de.id });
  }

  async pocketIdsOfLineages(em: EntityManager, pocketIds: string[]): Promise<string[]> {
    if (pocketIds.length === 0) return [];
    const rows = await em.find(Pocket, { where: { id: In(pocketIds) }, select: { lineageId: true } });
    const lineages = [...new Set(rows.map((r) => r.lineageId))];
    if (lineages.length === 0) return [];
    const versions = await em.find(Pocket, { where: { lineageId: In(lineages) }, select: { id: true } });
    return versions.map((v) => v.id);
  }
}
