import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { notFound } from '../common/errors.js';
import { Account, DailyExpense, DivisionPlan, Expenditure, Pocket, Wishlist } from '../database/entities/index.js';

// Resolves entities only if they belong to the given user; anything else is reported as not found.
@Injectable()
export class OwnershipService {
  constructor(private readonly dataSource: DataSource) {}

  async account(userId: string, id: string, em: EntityManager = this.dataSource.manager): Promise<Account> {
    const account = await em.findOneBy(Account, { id, userId });
    if (!account) throw notFound('account_not_found');
    return account;
  }

  async plan(userId: string, id: string, em: EntityManager = this.dataSource.manager): Promise<DivisionPlan & { account: Account }> {
    const plan = await em
      .createQueryBuilder(DivisionPlan, 'plan')
      .innerJoinAndSelect('plan.account', 'account')
      .where('plan.id = :id AND account.userId = :userId', { id, userId })
      .getOne();
    if (!plan) throw notFound('plan_not_found');
    return plan as DivisionPlan & { account: Account };
  }

  async pocket(userId: string, id: string, em: EntityManager = this.dataSource.manager): Promise<Pocket & { plan: DivisionPlan & { account: Account } }> {
    const pocket = await em
      .createQueryBuilder(Pocket, 'pocket')
      .innerJoinAndSelect('pocket.plan', 'plan')
      .innerJoinAndSelect('plan.account', 'account')
      .where('pocket.id = :id AND account.userId = :userId', { id, userId })
      .getOne();
    if (!pocket) throw notFound('pocket_not_found');
    return pocket as Pocket & { plan: DivisionPlan & { account: Account } };
  }

  async dailyExpense(userId: string, id: string, em: EntityManager = this.dataSource.manager) {
    const de = await em
      .createQueryBuilder(DailyExpense, 'de')
      .innerJoinAndSelect('de.pocket', 'pocket')
      .innerJoinAndSelect('pocket.plan', 'plan')
      .innerJoinAndSelect('plan.account', 'account')
      .where('de.id = :id AND account.userId = :userId', { id, userId })
      .getOne();
    if (!de) throw notFound('daily_expense_not_found');
    return de as DailyExpense & { pocket: Pocket & { plan: DivisionPlan & { account: Account } } };
  }

  async expenditure(userId: string, id: string, em: EntityManager = this.dataSource.manager) {
    const expenditure = await em
      .createQueryBuilder(Expenditure, 'e')
      .innerJoinAndSelect('e.dailyExpense', 'de')
      .innerJoinAndSelect('de.pocket', 'pocket')
      .innerJoinAndSelect('pocket.plan', 'plan')
      .innerJoinAndSelect('plan.account', 'account')
      .where('e.id = :id AND account.userId = :userId', { id, userId })
      .getOne();
    if (!expenditure) throw notFound('expenditure_not_found');
    return expenditure as Expenditure & { dailyExpense: DailyExpense & { pocket: Pocket & { plan: DivisionPlan & { account: Account } } } };
  }

  async wishlist(userId: string, id: string, em: EntityManager = this.dataSource.manager): Promise<Wishlist & { account: Account }> {
    const wishlist = await em
      .createQueryBuilder(Wishlist, 'w')
      .innerJoinAndSelect('w.account', 'account')
      .where('w.id = :id AND account.userId = :userId', { id, userId })
      .getOne();
    if (!wishlist) throw notFound('wishlist_not_found');
    return wishlist as Wishlist & { account: Account };
  }
}
