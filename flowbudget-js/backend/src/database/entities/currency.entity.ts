import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('currencies')
export class Currency {
  @PrimaryColumn({ type: 'varchar', length: 3 })
  code: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  country: string | null;
}
