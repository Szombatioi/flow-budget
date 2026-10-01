import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { AUTH, createAuth, createAuthPool } from './auth.js';
import { AuthGuard } from './auth.guard.js';

@Global()
@Module({
  providers: [
    {
      provide: AUTH,
      inject: [APP_CONFIG, CryptoService],
      useFactory: (config: AppConfig, crypto: CryptoService) =>
        createAuth(config, createAuthPool(config), (userId) => crypto.ensureUserKey(userId)),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AUTH],
})
export class AuthModule {}
