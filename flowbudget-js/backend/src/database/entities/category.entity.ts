import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  displayName: string;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  userId: string | null;
}
