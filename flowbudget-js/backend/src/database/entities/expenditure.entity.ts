import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { numericTransformer } from '../../common/money.js';
import { Category } from './category.entity.js';
import { DailyExpense } from './daily-expense.entity.js';
import { Wishlist } from './wishlist.entity.js';

@Entity('expenditures')
export class Expenditure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, transformer: numericTransformer })
  price: number;

  // Name and description are encrypted with the owner's data encryption key.
  @Column({ type: 'bytea' })
  nameEnc: Buffer;

  @Column({ type: 'bytea', nullable: true })
  descriptionEnc: Buffer | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: Relation<Category> | null;

  @Index()
  @Column({ type: 'uuid' })
  dailyExpenseId: string;

  @ManyToOne(() => DailyExpense, (de) => de.expenditures, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dailyExpenseId' })
  dailyExpense: Relation<DailyExpense>;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  wishlistId: string | null;

  @ManyToOne(() => Wishlist, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'wishlistId' })
  wishlist: Relation<Wishlist> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
