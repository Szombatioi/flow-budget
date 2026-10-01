import { Column, CreateDateColumn, Index } from 'typeorm';

// Incomes, fixed expenses and pockets are versioned: an edit that changes the amount/ratio creates a new
// row in the same lineage, effective from the first day of a month. A tombstone row (isDeleted) ends
// the lineage from its month while keeping the history of previous months intact.
export abstract class Versioned {
  @Index()
  @Column({ type: 'uuid' })
  lineageId: string;

  @Column({ type: 'date' })
  activeFrom: string;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
