import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { getMigrations } from 'better-auth/db/migration';
import { haveIBeenPwned } from 'better-auth/plugins/haveibeenpwned';
import { username } from 'better-auth/plugins/username';
import pg from 'pg';
import { isStrongPassword } from '../common/password.js';
import type { AppConfig } from '../config/config.js';

export const AUTH = Symbol('AUTH');

export type UserCreatedHook = (userId: string) => Promise<void>;

function authOptions(config: AppConfig, pool: pg.Pool, onUserCreated?: UserCreatedHook) {
  return {
    appName: 'FlowBudget',
    secret: config.auth.secret,
    baseURL: config.auth.baseUrl,
    basePath: '/api/auth',
    trustedOrigins: config.auth.trustedOrigins,
    database: pool,
    // Prefixed so they don't clash with the application's own tables (e.g. financial "accounts").
    user: { modelName: 'auth_user' },
    session: { modelName: 'auth_session', expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    account: { modelName: 'auth_account' },
    verification: { modelName: 'auth_verification' },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      disableSignUp: config.auth.disableSignUp,
      minPasswordLength: config.auth.minPasswordLength,
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!config.auth.requireStrongPasswords) return;
        const password = ctx.path === '/sign-up/email' ? ctx.body?.password : ctx.path === '/change-password' ? ctx.body?.newPassword : undefined;
        if (typeof password === 'string' && !isStrongPassword(password)) {
          throw APIError.from('BAD_REQUEST', { message: 'Use at least three of: lowercase, uppercase, digit, symbol.', code: 'PASSWORD_TOO_WEAK' });
        }
      }),
    },
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 50 }), haveIBeenPwned({ enabled: config.auth.checkPwnedPasswords })],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await onUserCreated?.(user.id);
          },
        },
      },
    },
  } satisfies BetterAuthOptions;
}

export function createAuth(config: AppConfig, pool: pg.Pool, onUserCreated: UserCreatedHook) {
  return betterAuth(authOptions(config, pool, onUserCreated));
}

export type Auth = ReturnType<typeof createAuth>;

export function createAuthPool(config: AppConfig) {
  return new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
}

// Better Auth owns its tables; they must exist before the TypeORM migrations add foreign keys to auth_user.
export async function runAuthMigrations(config: AppConfig) {
  const pool = createAuthPool(config);
  try {
    const { runMigrations } = await getMigrations(authOptions(config, pool));
    await runMigrations();
  } finally {
    await pool.end();
  }
}
