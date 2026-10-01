import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// Application-specific user data. Identity (name, email, password) lives in Better Auth's auth_user table.
@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  userId: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  theme: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language: string | null;

  @Column({ type: 'bytea', nullable: true })
  apiKeyEnc: Buffer | null;

  @Column({ type: 'bytea' })
  wrappedDek: Buffer;

  @Column({ type: 'int' })
  kekVersion: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
