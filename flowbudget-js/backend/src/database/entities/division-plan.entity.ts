import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Account } from './account.entity.js';

@Entity('division_plans')
export class DivisionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'date', nullable: true })
  activeFrom: string | null;

  @Index()
  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: Relation<Account>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
