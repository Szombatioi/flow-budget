import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { AppConfig } from '../config/config.js';

export interface KmsService {
  readonly currentKeyVersion: number;
  wrap(dek: Buffer, version: number): Promise<Buffer>;
  unwrap(wrapped: Buffer, version: number): Promise<Buffer>;
}

export const KMS_SERVICE = Symbol('KMS_SERVICE');

// KEKs supplied via environment variables. Rotating: add a new version and bump KMS_CURRENT_KEY_VERSION;
// existing DEKs keep working as long as their KEK version stays in KMS_LOCAL_KEYS.
export class LocalKmsService implements KmsService {
  constructor(private readonly keys: Map<number, Buffer>, readonly currentKeyVersion: number) {}

  async wrap(dek: Buffer, version: number): Promise<Buffer> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(version), iv);
    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    return Buffer.concat([iv, encrypted, cipher.getAuthTag()]);
  }

  async unwrap(wrapped: Buffer, version: number): Promise<Buffer> {
    const decipher = createDecipheriv('aes-256-gcm', this.key(version), wrapped.subarray(0, 12));
    decipher.setAuthTag(wrapped.subarray(wrapped.length - 16));
    return Buffer.concat([decipher.update(wrapped.subarray(12, wrapped.length - 16)), decipher.final()]);
  }

  private key(version: number): Buffer {
    const key = this.keys.get(version);
    if (!key) throw new Error(`KEK version ${version} is not configured`);
    return key;
  }
}

export class VaultKmsService implements KmsService {
  constructor(private readonly options: AppConfig['kms']['vault'], readonly currentKeyVersion: number) {}

  async wrap(dek: Buffer, version: number): Promise<Buffer> {
    const data = await this.call('encrypt', { plaintext: dek.toString('base64'), key_version: version });
    return Buffer.from(data.ciphertext, 'utf8');
  }

  async unwrap(wrapped: Buffer): Promise<Buffer> {
    const data = await this.call('decrypt', { ciphertext: wrapped.toString('utf8') });
    return Buffer.from(data.plaintext, 'base64');
  }

  private async call(op: 'encrypt' | 'decrypt', body: object): Promise<{ ciphertext: string; plaintext: string }> {
    const res = await fetch(`${this.options.address}/v1/transit/${op}/${this.options.keyName}`, {
      method: 'POST',
      headers: { 'X-Vault-Token': this.options.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Vault transit ${op} failed with status ${res.status}`);
    return ((await res.json()) as { data: { ciphertext: string; plaintext: string } }).data;
  }
}

export function createKms(config: AppConfig): KmsService {
  return config.kms.provider === 'vault'
    ? new VaultKmsService(config.kms.vault, config.kms.currentKeyVersion)
    : new LocalKmsService(config.kms.localKeys, config.kms.currentKeyVersion);
}
