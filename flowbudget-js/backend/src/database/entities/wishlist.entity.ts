import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { numericTransformer } from '../../common/money.js';
import { Account } from './account.entity.js';

export enum WishlistMode {
  Manual = 'manual',
  Automatic = 'automatic',
}

export enum WishlistStatus {
  Inactive = 'inactive',
  Active = 'active',
  Completed = 'completed',
}

@Entity('wishlists')
export class Wishlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, transformer: numericTransformer })
  goal: number;

  @Column({ type: 'date' })
  targetDate: string;

  @Column({ type: 'varchar', length: 20, default: WishlistMode.Manual })
  mode: WishlistMode;

  @Column({ type: 'varchar', length: 20, default: WishlistStatus.Inactive })
  status: WishlistStatus;

  @Index()
  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: Relation<Account>;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
