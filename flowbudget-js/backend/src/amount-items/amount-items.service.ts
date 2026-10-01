import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager, MoreThanOrEqual } from 'typeorm';
import { monthStart, today } from '../common/dates.js';
import { badRequest, notFound } from '../common/errors.js';
import { effectiveVersion, upcomingVersion } from '../common/versioning.js';
import { FixedExpense, Income } from '../database/entities/index.js';
import type { BudgetService } from '../domain/budget.service.js';
import type { OwnershipService } from '../domain/ownership.service.js';
import type { AmountItemDto, CreateAmountItemDto, UpdateAmountItemDto } from './amount-items.dto.js';

type AmountEntity = typeof Income | typeof FixedExpense;

export abstract class AmountItemsService {
  protected constructor(
    private readonly entity: AmountEntity,
    private readonly dataSource: DataSource,
    private readonly ownership: OwnershipService,
    private readonly budget: BudgetService,
  ) {}

  async list(userId: string, accountId: string): Promise<AmountItemDto[]> {
    await this.ownership.account(userId, accountId);
    const rows = await this.dataSource.getRepository<Income>(this.entity).find({ where: { accountId }, order: { createdAt: 'ASC' } });
    const month = monthStart(today());

    const lineages = new Map<string, Income[]>();
    for (const row of rows) lineages.set(row.lineageId, [...(lineages.get(row.lineageId) ?? []), row]);

    return [...lineages.values()].flatMap((versions) => {
      const current = effectiveVersion(versions, month);
      if (!current) return [];
      const next = upcomingVersion(versions, month);
      return [
        {
          id: current.id,
          lineageId: current.lineageId,
          name: current.name,
          amount: current.amount,
          activeFrom: current.activeFrom,
          upcoming: next ? { name: next.name, amount: next.amount, activeFrom: next.activeFrom, isDeleted: next.isDeleted } : null,
        },
      ];
    });
  }

  async create(userId: string, dto: CreateAmountItemDto): Promise<{ id: string }> {
    const month = monthStart(today());
    return this.dataSource.transaction(async (em) => {
      await this.ownership.account(userId, dto.accountId, em);
      const id = randomUUID();
      await em.insert(this.entity, { id, lineageId: id, accountId: dto.accountId, name: dto.name.trim(), amount: dto.amount, activeFrom: month });
      await this.budget.recalculateAccountFrom(em, dto.accountId, month);
      return { id };
    });
  }

  async update(userId: string, id: string, dto: UpdateAmountItemDto): Promise<void> {
    const currentMonth = monthStart(today());
    const from = dto.from ?? currentMonth;
    if (from < currentMonth) throw badRequest('cannot_change_past_months');

    await this.dataSource.transaction(async (em) => {
      const item = await this.load(em, userId, id);
      const repo = em.getRepository<Income>(this.entity);

      if (dto.name !== undefined) await repo.update({ lineageId: item.lineageId }, { name: dto.name.trim() });
      if (dto.amount === undefined || dto.amount === item.amount) return;

      const sameMonth = await repo.findOneBy({ lineageId: item.lineageId, activeFrom: from, isDeleted: false });
      if (sameMonth) {
        await repo.update({ id: sameMonth.id }, { amount: dto.amount });
      } else {
        await repo.insert({
          id: randomUUID(),
          lineageId: item.lineageId,
          accountId: item.accountId,
          name: dto.name?.trim() ?? item.name,
          amount: dto.amount,
          activeFrom: from,
        });
      }
      await this.budget.recalculateAccountFrom(em, item.accountId, from);
    });
  }

  // Ends the lineage from the current month; previous months keep their history.
  async remove(userId: string, id: string): Promise<void> {
    const month = monthStart(today());
    await this.dataSource.transaction(async (em) => {
      const item = await this.load(em, userId, id);
      const repo = em.getRepository<Income>(this.entity);
      await repo.delete({ lineageId: item.lineageId, activeFrom: MoreThanOrEqual(month) });
      if (await repo.existsBy({ lineageId: item.lineageId })) {
        await repo.insert({ id: randomUUID(), lineageId: item.lineageId, accountId: item.accountId, name: item.name, amount: 0, activeFrom: month, isDeleted: true });
      }
      await this.budget.recalculateAccountFrom(em, item.accountId, month);
    });
  }

  private async load(em: EntityManager, userId: string, id: string): Promise<Income> {
    const item = await em
      .getRepository<Income>(this.entity)
      .createQueryBuilder('item')
      .innerJoin('item.account', 'account')
      .where('item.id = :id AND account.userId = :userId', { id, userId })
      .getOne();
    if (!item) throw notFound();
    return item;
  }
}
