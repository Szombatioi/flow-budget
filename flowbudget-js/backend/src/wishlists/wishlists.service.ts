import { Injectable, Logger } from '@nestjs/common';
import { DataSource, type EntityManager, In, IsNull, MoreThan } from 'typeorm';
import { addDays, type DateStr, diffDays, monthStart, toDateStr, today } from '../common/dates.js';
import { badRequest, conflict } from '../common/errors.js';
import { roundMoney } from '../common/money.js';
import { Account, DailyExpense, Expenditure, Wishlist, WishlistMode, WishlistStatus } from '../database/entities/index.js';
import { BudgetService } from '../domain/budget.service.js';
import { OwnershipService } from '../domain/ownership.service.js';
import { ExpendituresService } from '../expenditures/expenditures.service.js';

export interface WishlistDto {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  mode: WishlistMode;
  status: WishlistStatus;
  currentAmount: number;
  targetAmount: number;
  targetDate: string;
  estimatedFinishDate: string | null;
  currencyCode: string;
  createdAt: string;
  affectedDailyExpenses?: { id: string; date: string; pocketName: string }[];
}

export interface CreateWishlistInput {
  accountId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  targetAmount: number;
  targetDate: string;
  mode: WishlistMode;
  affectedDailyExpenseIds: string[];
}

export interface MoveMoneyInput {
  pocketId: string;
  name: string;
  description?: string | null;
  amount: number;
  date: string;
}

interface Progress {
  total: number;
  firstDate: DateStr | null;
  lastDate: DateStr | null;
}

@Injectable()
export class WishlistsService {
  private readonly logger = new Logger(WishlistsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ownership: OwnershipService,
    private readonly budget: BudgetService,
    private readonly expenditures: ExpendituresService,
  ) {}

  async list(userId: string): Promise<WishlistDto[]> {
    await this.sweep(userId);
    const wishlists = await this.dataSource.manager
      .createQueryBuilder(Wishlist, 'w')
      .innerJoinAndSelect('w.account', 'account')
      .where('account.userId = :userId', { userId })
      .orderBy('w.createdAt', 'ASC')
      .getMany();
    const progress = await this.progress(this.dataSource.manager, wishlists.map((w) => w.id));
    return wishlists.map((w) => this.toDto(w as Wishlist & { account: Account }, progress.get(w.id)));
  }

  async get(userId: string, id: string): Promise<WishlistDto> {
    const wishlist = await this.ownership.wishlist(userId, id);
    const progress = await this.progress(this.dataSource.manager, [id]);
    const affected = await this.dataSource.manager.find(DailyExpense, { where: { wishlistId: id }, relations: { pocket: true }, order: { date: 'ASC' } });
    return {
      ...this.toDto(wishlist, progress.get(id)),
      affectedDailyExpenses: affected.map((de) => ({ id: de.id, date: de.date, pocketName: de.pocket.name })),
    };
  }

  async create(userId: string, input: CreateWishlistInput): Promise<WishlistDto> {
    const id = await this.dataSource.transaction(async (em) => {
      await this.ownership.account(userId, input.accountId, em);
      const wishlist = await em.save(
        em.create(Wishlist, {
          accountId: input.accountId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          imageUrl: input.imageUrl?.trim() || null,
          goal: input.targetAmount,
          targetDate: input.targetDate,
          mode: input.mode,
          status: WishlistStatus.Inactive,
        }),
      );

      const ids = input.mode === WishlistMode.Automatic ? [...new Set(input.affectedDailyExpenseIds)] : [];
      if (ids.length > 0) {
        const days = await em
          .createQueryBuilder(DailyExpense, 'de')
          .innerJoin('de.pocket', 'pocket')
          .innerJoin('pocket.plan', 'plan')
          .where('de.id IN (:...ids) AND plan.accountId = :accountId', { ids, accountId: input.accountId })
          .getMany();
        if (days.length !== ids.length) throw badRequest('daily_expense_not_found');
        if (days.some((d) => d.wishlistId !== null)) throw conflict('daily_expense_already_linked');
        await em.update(DailyExpense, { id: In(ids) }, { wishlistId: wishlist.id });
      }
      return wishlist.id;
    });
    return this.get(userId, id);
  }

  async setActive(userId: string, id: string, active: boolean): Promise<void> {
    const wishlist = await this.ownership.wishlist(userId, id);
    if (wishlist.status === WishlistStatus.Completed) throw conflict('wishlist_completed');
    await this.dataSource.getRepository(Wishlist).update({ id }, { status: active ? WishlistStatus.Active : WishlistStatus.Inactive });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.ownership.wishlist(userId, id);
    await this.dataSource.getRepository(Wishlist).delete({ id });
  }

  async align(userId: string, wishlistId: string, dailyExpenseId: string): Promise<void> {
    const wishlist = await this.ownership.wishlist(userId, wishlistId);
    const day = await this.ownership.dailyExpense(userId, dailyExpenseId);
    if (wishlist.mode !== WishlistMode.Automatic) throw badRequest('wishlist_not_automatic');
    if (wishlist.status === WishlistStatus.Completed) throw conflict('wishlist_completed');
    if (wishlist.accountId !== day.pocket.plan.accountId) throw badRequest('wishlist_account_mismatch');
    if (day.date < today()) throw badRequest('cannot_link_past_day');
    await this.dataSource.getRepository(DailyExpense).update({ id: dailyExpenseId }, { wishlistId });
  }

  async unalign(userId: string, dailyExpenseId: string): Promise<void> {
    const day = await this.ownership.dailyExpense(userId, dailyExpenseId);
    if (day.date < today()) throw badRequest('cannot_link_past_day');
    await this.dataSource.getRepository(DailyExpense).update({ id: dailyExpenseId }, { wishlistId: null });
  }

  async moveMoney(userId: string, wishlistId: string, input: MoveMoneyInput): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const wishlist = await this.ownership.wishlist(userId, wishlistId, em);
      await this.contribute(em, userId, wishlist, input);
    });
  }

  /*
   * Moves the remaining money of finished days to their linked automatic wishlists. This replaces the
   * nightly background job: it runs lazily whenever the user's dashboard or wishlists are loaded, and every
   * day is swept at most once.
   */
  async sweep(userId: string): Promise<void> {
    const days = await this.dataSource.manager
      .createQueryBuilder(DailyExpense, 'de')
      .innerJoinAndSelect('de.wishlist', 'w')
      .innerJoin('w.account', 'account')
      .where('account.userId = :userId', { userId })
      .andWhere('w.status = :status AND w.mode = :mode', { status: WishlistStatus.Active, mode: WishlistMode.Automatic })
      .andWhere('de.isStarted = true AND de.wishlistSweptAt IS NULL AND de.date < :today', { today: today() })
      .orderBy('de.date', 'ASC')
      .getMany();

    for (const day of days) {
      await this.dataSource
        .transaction(async (em) => {
        const fresh = await em.findOneBy(DailyExpense, { id: day.id, wishlistSweptAt: IsNull() });
        if (!fresh) return;
        const wishlist = await this.ownership.wishlist(userId, day.wishlistId!, em);
        if (fresh.eodAmount > 0 && wishlist.status === WishlistStatus.Active) {
          await this.contribute(em, userId, wishlist, {
            pocketId: fresh.pocketId,
            name: `[Sweep] (${fresh.date})`,
            amount: roundMoney(fresh.eodAmount),
            date: fresh.date,
          });
        }
        await em.update(DailyExpense, { id: fresh.id }, { wishlistSweptAt: new Date() });
        })
        .catch(async (err: Error) => {
          this.logger.warn(`Wishlist sweep skipped for day ${day.id}: ${err.message}`);
          await this.dataSource.getRepository(DailyExpense).update({ id: day.id }, { wishlistSweptAt: new Date() });
        });
    }
  }

  private async contribute(em: EntityManager, userId: string, wishlist: Wishlist & { account: Account }, input: MoveMoneyInput) {
    if (wishlist.status === WishlistStatus.Inactive) throw badRequest('wishlist_inactive');
    if (wishlist.status === WishlistStatus.Completed) throw badRequest('wishlist_completed');

    const pocket = await this.ownership.pocket(userId, input.pocketId, em);
    if (pocket.plan.accountId !== wishlist.accountId) throw badRequest('wishlist_account_mismatch');
    const day = await this.expenditures.resolveDay(em, pocket, input.date);
    if (!day.isStarted) throw badRequest('de_not_started');

    await this.expenditures.addInTx(em, userId, { pocketId: pocket.id, name: input.name, description: input.description, price: input.amount, date: day.date }, wishlist.id);
    await this.budget.recalculatePocketMonth(em, day.pocketId, monthStart(day.date));

    const total = (await this.progress(em, [wishlist.id])).get(wishlist.id)?.total ?? 0;
    if (total >= wishlist.goal) {
      await em.update(Wishlist, { id: wishlist.id }, { status: WishlistStatus.Completed, completedAt: new Date() });
      if (wishlist.mode === WishlistMode.Automatic) {
        await em.update(DailyExpense, { wishlistId: wishlist.id, date: MoreThan(today()) }, { wishlistId: null });
      }
    }
  }

  private async progress(em: EntityManager, ids: string[]): Promise<Map<string, Progress>> {
    if (ids.length === 0) return new Map();
    const rows = await em
      .createQueryBuilder(Expenditure, 'e')
      .select('e.wishlistId', 'id')
      .addSelect('SUM(e.price)', 'total')
      .addSelect(`to_char(MIN(e.date), 'YYYY-MM-DD')`, 'firstDate')
      .addSelect(`to_char(MAX(e.date), 'YYYY-MM-DD')`, 'lastDate')
      .where('e.wishlistId IN (:...ids)', { ids })
      .groupBy('e.wishlistId')
      .getRawMany<{ id: string; total: string; firstDate: string; lastDate: string }>();
    return new Map(rows.map((r) => [r.id, { total: roundMoney(Number.parseFloat(r.total)), firstDate: r.firstDate, lastDate: r.lastDate }]));
  }

  private estimateFinish(wishlist: Wishlist, progress: Progress | undefined): DateStr | null {
    if (wishlist.status === WishlistStatus.Completed) return wishlist.completedAt ? toDateStr(wishlist.completedAt) : (progress?.lastDate ?? null);
    if (!progress || progress.total <= 0 || !progress.firstDate) return null;
    const now = today();
    const elapsed = Math.max(1, diffDays(progress.firstDate, now) + 1);
    const perDay = progress.total / elapsed;
    return addDays(now, Math.ceil((wishlist.goal - progress.total) / perDay));
  }

  private toDto(w: Wishlist & { account: Account }, progress: Progress | undefined): WishlistDto {
    return {
      id: w.id,
      accountId: w.accountId,
      name: w.name,
      description: w.description,
      imageUrl: w.imageUrl,
      mode: w.mode,
      status: w.status,
      currentAmount: progress?.total ?? 0,
      targetAmount: w.goal,
      targetDate: w.targetDate,
      estimatedFinishDate: this.estimateFinish(w, progress),
      currencyCode: w.account.currencyCode,
      createdAt: w.createdAt.toISOString(),
    };
  }
}
