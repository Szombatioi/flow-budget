import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { UserProfile } from '../database/entities/index.js';
import { KMS_SERVICE, type KmsService } from './kms.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 10_000;

// Envelope encryption: every user has a random DEK (wrapped by the KMS) used for AES-256-GCM field encryption.
// Blob layout: nonce (12) || ciphertext || tag (16)
@Injectable()
export class CryptoService {
  private readonly cache = new Map<string, { dek: Buffer; expiresAt: number }>();

  constructor(
    @Inject(KMS_SERVICE) private readonly kms: KmsService,
    private readonly dataSource: DataSource,
  ) {}

  async ensureUserKey(userId: string): Promise<void> {
    const version = this.kms.currentKeyVersion;
    const wrappedDek = await this.kms.wrap(randomBytes(32), version);
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(UserProfile)
      .values({ userId, wrappedDek, kekVersion: version })
      .orIgnore()
      .execute();
  }

  async encrypt(userId: string, plaintext: string): Promise<Buffer> {
    const dek = await this.getDek(userId);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dek, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([nonce, encrypted, cipher.getAuthTag()]);
  }

  async encryptNullable(userId: string, plaintext: string | null | undefined): Promise<Buffer | null> {
    return plaintext ? this.encrypt(userId, plaintext) : null;
  }

  async decrypt(userId: string, blob: Buffer | null): Promise<string | null> {
    if (!blob || blob.length < 28) return null;
    const dek = await this.getDek(userId);
    const decipher = createDecipheriv('aes-256-gcm', dek, blob.subarray(0, 12));
    decipher.setAuthTag(blob.subarray(blob.length - 16));
    return Buffer.concat([decipher.update(blob.subarray(12, blob.length - 16)), decipher.final()]).toString('utf8');
  }

  evict(userId: string) {
    this.cache.delete(userId);
  }

  private async getDek(userId: string): Promise<Buffer> {
    const hit = this.cache.get(userId);
    if (hit && hit.expiresAt > Date.now()) {
      hit.expiresAt = Date.now() + CACHE_TTL_MS;
      return hit.dek;
    }

    const load = () =>
      this.dataSource.getRepository(UserProfile).findOne({
        where: { userId },
        select: { userId: true, wrappedDek: true, kekVersion: true },
      });
    let profile = await load();
    if (!profile) {
      await this.ensureUserKey(userId);
      profile = await load();
    }
    if (!profile) throw new Error(`User ${userId} has no encryption key`);

    const dek = await this.kms.unwrap(profile.wrappedDek, profile.kekVersion);
    if (this.cache.size >= CACHE_MAX_ENTRIES) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(userId, { dek, expiresAt: Date.now() + CACHE_TTL_MS });
    return dek;
  }
}
