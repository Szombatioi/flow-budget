import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { numericTransformer } from '../../common/money.js';
import { Account } from './account.entity.js';
import { Versioned } from './versioned.js';

@Entity('fixed_expenses')
export class FixedExpense extends Versioned {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, transformer: numericTransformer })
  amount: number;

  @Index()
  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: Relation<Account>;
}
