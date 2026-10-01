import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique, type Relation } from 'typeorm';
import { numericTransformer } from '../../common/money.js';
import { Expenditure } from './expenditure.entity.js';
import { Pocket } from './pocket.entity.js';
import { Wishlist } from './wishlist.entity.js';

@Entity('daily_expenses')
@Unique('UQ_daily_expenses_pocket_date', ['pocketId', 'date'])
export class DailyExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  // Daily share plus the previous day's carry-over.
  @Column({ type: 'numeric', precision: 18, scale: 2, transformer: numericTransformer })
  startAmount: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, transformer: numericTransformer })
  eodAmount: number;

  // The daily share without carry-over.
  @Column({ type: 'numeric', precision: 18, scale: 2, transformer: numericTransformer })
  relativeBudget: number;

  @Column({ type: 'boolean', default: false })
  isStarted: boolean;

  @Column({ type: 'uuid' })
  pocketId: string;

  @ManyToOne(() => Pocket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pocketId' })
  pocket: Relation<Pocket>;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  wishlistId: string | null;

  @ManyToOne(() => Wishlist, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'wishlistId' })
  wishlist: Relation<Wishlist> | null;

  @Column({ type: 'timestamptz', nullable: true })
  wishlistSweptAt: Date | null;

  @OneToMany(() => Expenditure, (e) => e.dailyExpense)
  expenditures: Relation<Expenditure[]>;
}
