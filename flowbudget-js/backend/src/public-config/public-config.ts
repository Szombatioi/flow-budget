import { Controller, Get, Inject, Module } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { APP_CONFIG, type AppConfig } from '../config/config.js';

// Settings the login and register pages need before anyone is signed in.
@Public()
@Controller('api/public-config')
export class PublicConfigController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  get() {
    const { disableSignUp, minPasswordLength, requireStrongPasswords } = this.config.auth;
    return { signUpEnabled: !disableSignUp, minPasswordLength, requireStrongPasswords };
  }
}

@Module({ controllers: [PublicConfigController] })
export class PublicConfigModule {}
