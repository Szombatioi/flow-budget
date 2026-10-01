import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { CryptoService } from './crypto.service.js';
import { createKms, KMS_SERVICE } from './kms.js';

@Global()
@Module({
  providers: [{ provide: KMS_SERVICE, inject: [APP_CONFIG], useFactory: (config: AppConfig) => createKms(config) }, CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
