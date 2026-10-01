import { Injectable } from '@nestjs/common';
import { Between, DataSource, In } from 'typeorm';
import { toCategoryDto, type CategoryDto } from '../categories/categories.js';
import { type DateStr, diffDays, monthStart, monthsBetween } from '../common/dates.js';
import { badRequest, notFound } from '../common/errors.js';
import { DailyExpense } from '../database/entities/index.js';
import { BudgetService } from '../domain/budget.service.js';
import { OwnershipService } from '../domain/ownership.service.js';
import type { ExpenditureDto } from '../expenditures/expenditures.dto.js';
import { ExpendituresService } from '../expenditures/expenditures.service.js';
import { WishlistsService } from '../wishlists/wishlists.service.js';

const MAX_RANGE_DAYS = 400;
const MAX_GENERATED_MONTHS = 12;

export interface DailyExpenseDto {
  id: string;
  date: string;
  startAmount: number;
  eodAmount: number;
  relativeBudget: number;
  isStarted: boolean;
  wishlistId: string | null;
  currency: string;
  pocket: { id: string; lineageId: string; name: string; ration: number };
  expenditures: ExpenditureDto[];
}

@Injectable()
export class DailyExpensesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ownership: OwnershipService,
    private readonly budget: BudgetService,
    private readonly expenditures: ExpendituresService,
    private readonly wishlists: WishlistsService,
  ) {}

  // Loading a day starts it, together with every not-yet-started day of the month before it.
  async get(userId: string, pocketId: string, date: DateStr): Promise<DailyExpenseDto> {
    const dayId = await this.dataSource.transaction(async (em) => {
      const pocket = await this.ownership.pocket(userId, pocketId, em);
      const day = await this.expenditures.resolveDay(em, pocket, date);
      if (!day.isStarted) await this.budget.recalculatePocketMonth(em, day.pocketId, monthStart(day.date), { activateUntil: date });
      return day.id;
    });
    await this.wishlists.sweep(userId);

    const day = await this.ownership.dailyExpense(userId, dayId);
    const rows = await this.expenditures
      .baseQuery(this.dataSource.manager, userId)
      .andWhere('e.dailyExpenseId = :dayId', { dayId })
      .orderBy('e.createdAt', 'ASC')
      .getMany();

    return {
      id: day.id,
      date: day.date,
      startAmount: day.startAmount,
      eodAmount: day.eodAmount,
      relativeBudget: day.relativeBudget,
      isStarted: day.isStarted,
      wishlistId: day.wishlistId,
      currency: day.pocket.plan.account.currencyCode,
      pocket: { id: day.pocket.id, lineageId: day.pocket.lineageId, name: day.pocket.name, ration: day.pocket.ration },
      expenditures: await this.expenditures.toDtos(userId, rows as Parameters<ExpendituresService['toDtos']>[1]),
    };
  }

  async timeSeries(userId: string, pocketId: string, from: DateStr, to: DateStr): Promise<{ name: string; price: number; category: CategoryDto | null; date: string }[]> {
    const pocketIds = await this.lineagePocketIds(userId, pocketId, from, to);
    const rows = await this.expenditures
      .baseQuery(this.dataSource.manager, userId)
      .andWhere('pocket.id IN (:...pocketIds) AND e.date BETWEEN :from AND :to', { pocketIds, from, to })
      .orderBy('e.date', 'ASC')
      .getMany();
    const dtos = await this.expenditures.toDtos(userId, rows as Parameters<ExpendituresService['toDtos']>[1]);
    return dtos.map((e, i) => ({ name: e.name, price: e.price, date: e.date, category: rows[i].category ? toCategoryDto(rows[i].category!) : null }));
  }

  async budgetSeries(userId: string, pocketId: string, from: DateStr, to: DateStr) {
    const pocketIds = await this.lineagePocketIds(userId, pocketId, from, to);
    const days = await this.dataSource.manager.find(DailyExpense, { where: { pocketId: In(pocketIds), date: Between(from, to) }, order: { date: 'ASC' } });
    return days.map((d) => ({ date: d.date, amount: d.relativeBudget, startAmount: d.startAmount, eodAmount: d.eodAmount, isStarted: d.isStarted }));
  }

  // Days a new automatic wishlist can be linked to; missing months are generated so future days can be picked.
  async inRange(userId: string, pocketId: string, from: DateStr, to: DateStr) {
    const pocket = await this.ownership.pocket(userId, pocketId);
    this.assertRange(from, to);
    const months = monthsBetween(from, to);
    if (months.length > MAX_GENERATED_MONTHS) throw badRequest('date_range_too_long');

    await this.dataSource.transaction(async (em) => {
      for (const month of months) await this.budget.ensureMonth(em, pocket.plan.accountId, month);
    });

    const pocketIds = await this.budget.pocketIdsOfLineages(this.dataSource.manager, [pocketId]);
    const days = await this.dataSource.manager.find(DailyExpense, {
      where: { pocketId: In(pocketIds), date: Between(from, to) },
      relations: { pocket: true },
      order: { date: 'ASC' },
    });
    return days.map((d) => ({ id: d.id, date: d.date, pocketName: d.pocket.name, wishlistId: d.wishlistId }));
  }

  private async lineagePocketIds(userId: string, pocketId: string, from: DateStr, to: DateStr): Promise<string[]> {
    await this.ownership.pocket(userId, pocketId);
    this.assertRange(from, to);
    const ids = await this.budget.pocketIdsOfLineages(this.dataSource.manager, [pocketId]);
    if (ids.length === 0) throw notFound('pocket_not_found');
    return ids;
  }

  private assertRange(from: DateStr, to: DateStr) {
    if (from > to) throw badRequest('invalid_date_range');
    if (diffDays(from, to) > MAX_RANGE_DAYS) throw badRequest('date_range_too_long');
  }
}
