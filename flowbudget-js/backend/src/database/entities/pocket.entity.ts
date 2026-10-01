import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { DivisionPlan } from './division-plan.entity.js';
import { Versioned } from './versioned.js';

@Entity('pockets')
export class Pocket extends Versioned {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'double precision' })
  ration: number;

  @Index()
  @Column({ type: 'uuid' })
  planId: string;

  @ManyToOne(() => DivisionPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planId' })
  plan: Relation<DivisionPlan>;
}
