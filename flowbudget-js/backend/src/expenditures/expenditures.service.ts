import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, type EntityManager, type SelectQueryBuilder } from 'typeorm';
import { toCategoryDto } from '../categories/categories.js';
import { addDays, type DateStr, monthEnd, monthStart, today, weekStart } from '../common/dates.js';
import { badRequest, conflict } from '../common/errors.js';
import { roundMoney } from '../common/money.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { Account, Category, DailyExpense, DivisionPlan, Expenditure, Pocket } from '../database/entities/index.js';
import { BudgetService } from '../domain/budget.service.js';
import { OwnershipService } from '../domain/ownership.service.js';
import type { CreateExpenditureDto, ExpenditureDto, ExpenditureQuery, UpdateExpenditureDto } from './expenditures.dto.js';

type LoadedExpenditure = Expenditure & {
  dailyExpense: DailyExpense & { pocket: Pocket & { plan: DivisionPlan & { account: Account } } };
};

type OwnedPocket = Pocket & { plan: DivisionPlan & { account: Account } };

@Injectable()
export class ExpendituresService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly crypto: CryptoService,
    private readonly ownership: OwnershipService,
    private readonly budget: BudgetService,
  ) {}

  async addMany(userId: string, items: CreateExpenditureDto[]): Promise<{ ids: string[] }> {
    return this.dataSource.transaction(async (em) => {
      const ids: string[] = [];
      const touched: { pocketId: string; month: string }[] = [];
      for (const item of items) {
        const { expenditure, dailyExpense } = await this.addInTx(em, userId, item);
        ids.push(expenditure.id);
        touched.push({ pocketId: dailyExpense.pocketId, month: monthStart(dailyExpense.date) });
      }
      await this.budget.recalculatePairs(em, touched);
      return { ids };
    });
  }

  // Inserts an expenditure without recalculating; callers recalculate the touched months.
  async addInTx(em: EntityManager, userId: string, item: CreateExpenditureDto, wishlistId: string | null = null) {
    const pocket = await this.ownership.pocket(userId, item.pocketId, em);
    const dailyExpense = await this.resolveDay(em, pocket, item.date ?? today());
    const categoryId = await this.validCategory(em, userId, item.categoryId);

    const expenditure = await em.save(
      em.create(Expenditure, {
        date: dailyExpense.date,
        price: item.price,
        nameEnc: await this.crypto.encrypt(userId, item.name.trim()),
        descriptionEnc: await this.crypto.encryptNullable(userId, item.description?.trim()),
        categoryId,
        dailyExpenseId: dailyExpense.id,
        wishlistId,
      }),
    );
    return { expenditure, dailyExpense };
  }

  // Finds the pocket's day (in whichever version of the pocket owns that month), generating the month if needed.
  async resolveDay(em: EntityManager, pocket: OwnedPocket, date: DateStr): Promise<DailyExpense> {
    const find = () =>
      em
        .createQueryBuilder(DailyExpense, 'de')
        .innerJoin('de.pocket', 'pocket')
        .where('pocket.lineageId = :lineageId AND de.date = :date', { lineageId: pocket.lineageId, date })
        .getOne();

    let dailyExpense = await find();
    if (!dailyExpense) {
      await this.budget.ensureMonth(em, pocket.plan.accountId, date);
      dailyExpense = await find();
    }
    if (!dailyExpense) throw conflict('pocket_not_active_on_date');
    return dailyExpense;
  }

  async update(userId: string, id: string, dto: UpdateExpenditureDto): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const expenditure = await this.ownership.expenditure(userId, id, em);
      await em.update(
        Expenditure,
        { id },
        {
          price: dto.price,
          nameEnc: await this.crypto.encrypt(userId, dto.name.trim()),
          descriptionEnc: await this.crypto.encryptNullable(userId, dto.description?.trim()),
          ...(dto.categoryId !== undefined ? { categoryId: await this.validCategory(em, userId, dto.categoryId) } : {}),
        },
      );
      await this.budget.recalculatePocketMonth(em, expenditure.dailyExpense.pocketId, monthStart(expenditure.dailyExpense.date));
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const expenditure = await this.ownership.expenditure(userId, id, em);
      await em.delete(Expenditure, { id });
      await this.budget.recalculatePocketMonth(em, expenditure.dailyExpense.pocketId, monthStart(expenditure.dailyExpense.date));
    });
  }

  async query(userId: string, q: ExpenditureQuery): Promise<{ total: number; items: ExpenditureDto[] }> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 10;
    const qb = this.baseQuery(this.dataSource.manager, userId);

    if (q.accountId) qb.andWhere('account.id = :accountId', { accountId: q.accountId });
    if (q.categoryId) qb.andWhere('e.categoryId = :categoryId', { categoryId: q.categoryId });
    if (q.pocketName) qb.andWhere('pocket.name = :pocketName', { pocketName: q.pocketName });
    if (q.from) qb.andWhere('e.date >= :from', { from: q.from });
    if (q.to) qb.andWhere('e.date <= :to', { to: q.to });

    const direction = q.sortDir === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(q.sortBy === 'price' ? 'e.price' : 'e.date', direction).addOrderBy('e.createdAt', direction);

    // Names and descriptions are encrypted, so text search has to run on the decrypted rows.
    const search = q.search?.trim().toLocaleLowerCase();
    if (search) {
      const all = await this.toDtos(userId, (await qb.getMany()) as LoadedExpenditure[]);
      const matches = all.filter((e) => e.name.toLocaleLowerCase().includes(search) || e.description?.toLocaleLowerCase().includes(search));
      return { total: matches.length, items: matches.slice((page - 1) * pageSize, page * pageSize) };
    }

    const [rows, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { total, items: await this.toDtos(userId, rows as LoadedExpenditure[]) };
  }

  async stats(userId: string, accountId?: string): Promise<{ monthly: number; weekly: number }> {
    const now = today();
    const sum = async (from: DateStr, to: DateStr) => {
      const qb = this.baseQuery(this.dataSource.manager, userId, false)
        .select('COALESCE(SUM(e.price), 0)', 'total')
        .andWhere('e.date BETWEEN :from AND :to', { from, to });
      if (accountId) qb.andWhere('account.id = :accountId', { accountId });
      return roundMoney(Number.parseFloat((await qb.getRawOne<{ total: string }>())?.total ?? '0'));
    };
    const week = weekStart(now);
    return { monthly: await sum(monthStart(now), monthEnd(now)), weekly: await sum(week, addDays(week, 6)) };
  }

  baseQuery(em: EntityManager, userId: string, select = true): SelectQueryBuilder<Expenditure> {
    const qb = em.createQueryBuilder(Expenditure, 'e');
    const join = select ? 'innerJoinAndSelect' : 'innerJoin';
    qb[join]('e.dailyExpense', 'de');
    qb[join]('de.pocket', 'pocket');
    qb[join]('pocket.plan', 'plan');
    qb[join]('plan.account', 'account');
    if (select) qb.leftJoinAndSelect('e.category', 'category').leftJoinAndSelect('e.wishlist', 'wishlist');
    return qb.where(new Brackets((w) => w.where('account.userId = :userId', { userId })));
  }

  async toDtos(userId: string, rows: LoadedExpenditure[]): Promise<ExpenditureDto[]> {
    return Promise.all(
      rows.map(async (e) => ({
        id: e.id,
        name: (await this.crypto.decrypt(userId, e.nameEnc)) ?? '',
        description: await this.crypto.decrypt(userId, e.descriptionEnc),
        price: e.price,
        date: e.date,
        createdAt: e.createdAt.toISOString(),
        currency: e.dailyExpense.pocket.plan.account.currencyCode,
        category: e.category ? toCategoryDto(e.category) : null,
        pocketId: e.dailyExpense.pocketId,
        pocketName: e.dailyExpense.pocket.name,
        accountId: e.dailyExpense.pocket.plan.accountId,
        wishlistId: e.wishlistId,
        wishlistName: e.wishlist?.name ?? null,
      })),
    );
  }

  private async validCategory(em: EntityManager, userId: string, categoryId: string | null | undefined): Promise<string | null> {
    if (!categoryId) return null;
    const exists = await em
      .createQueryBuilder(Category, 'c')
      .where('c.id = :categoryId AND (c.userId IS NULL OR c.userId = :userId)', { categoryId, userId })
      .getExists();
    if (!exists) throw badRequest('category_not_found');
    return categoryId;
  }
}
