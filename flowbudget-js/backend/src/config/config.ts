import { existsSync } from 'node:fs';

export interface AppConfig {
  port: number;
  databaseUrl: string;
  databaseSsl: boolean;
  auth: {
    secret: string;
    baseUrl: string;
    trustedOrigins: string[];
    minPasswordLength: number;
  };
  kms: {
    provider: 'local' | 'vault';
    currentKeyVersion: number;
    localKeys: Map<number, Buffer>;
    vault: { address: string; token: string; keyName: string };
  };
  gemini: { model: string; apiBase: string };
  uploadMaxBytes: number;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) throw new Error(`Environment variable ${name} must be an integer`);
  return value;
}

// Format: "1:<base64 32-byte key>,2:<base64 32-byte key>"
function parseLocalKeys(raw: string | undefined): Map<number, Buffer> {
  const keys = new Map<number, Buffer>();
  if (!raw) return keys;
  for (const part of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
    const [version, key] = part.split(':');
    const buffer = Buffer.from(key ?? '', 'base64');
    if (buffer.length !== 32) throw new Error(`KMS_LOCAL_KEYS: key version ${version} must be 32 bytes (base64)`);
    keys.set(Number.parseInt(version, 10), buffer);
  }
  return keys;
}

export function loadConfig(): AppConfig {
  if (existsSync('.env')) process.loadEnvFile('.env');

  const baseUrl = required('BETTER_AUTH_URL');
  const secret = required('BETTER_AUTH_SECRET');
  if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters long');

  const provider = (process.env.KMS_PROVIDER ?? 'local') as AppConfig['kms']['provider'];
  if (provider !== 'local' && provider !== 'vault') throw new Error('KMS_PROVIDER must be "local" or "vault"');

  const config: AppConfig = {
    port: int('PORT', 3001),
    databaseUrl: required('DATABASE_URL'),
    databaseSsl: process.env.DATABASE_SSL === 'true',
    auth: {
      secret,
      baseUrl,
      trustedOrigins: (process.env.TRUSTED_ORIGINS ?? baseUrl).split(',').map((o) => o.trim()).filter(Boolean),
      minPasswordLength: int('MIN_PASSWORD_LENGTH', 8),
    },
    kms: {
      provider,
      currentKeyVersion: int('KMS_CURRENT_KEY_VERSION', 1),
      localKeys: parseLocalKeys(process.env.KMS_LOCAL_KEYS),
      vault: {
        address: process.env.VAULT_ADDR ?? 'http://localhost:8200',
        token: process.env.VAULT_TOKEN ?? '',
        keyName: process.env.VAULT_KEY_NAME ?? 'flowbudget-kek',
      },
    },
    gemini: {
      model: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
      apiBase: process.env.GEMINI_API_BASE ?? 'https://generativelanguage.googleapis.com/v1beta',
    },
    uploadMaxBytes: int('UPLOAD_MAX_BYTES', 10 * 1024 * 1024),
  };

  if (provider === 'local' && !config.kms.localKeys.has(config.kms.currentKeyVersion)) {
    throw new Error(`KMS_LOCAL_KEYS must contain the current key version (${config.kms.currentKeyVersion})`);
  }
  if (provider === 'vault' && !config.kms.vault.token) throw new Error('VAULT_TOKEN is required when KMS_PROVIDER=vault');

  return config;
}
