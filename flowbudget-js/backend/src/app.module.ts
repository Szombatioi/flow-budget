import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from './accounts/accounts.js';
import { AmountItemsModule } from './amount-items/amount-items.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.js';
import { ConfigModule } from './config/config.module.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { CurrenciesModule } from './currencies/currencies.js';
import { DailyExpensesModule } from './daily-expenses/daily-expenses.module.js';
import { dataSourceOptions } from './database/data-source.js';
import { DomainModule } from './domain/domain.module.js';
import { ExpendituresModule } from './expenditures/expenditures.module.js';
import { HealthController } from './health/health.controller.js';
import { PlansModule } from './plans/plans.module.js';
import { SeedService } from './seed/seed.service.js';
import { UsersModule } from './users/users.js';
import { WishlistsModule } from './wishlists/wishlists.module.js';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({ useFactory: () => ({ ...dataSourceOptions(), migrationsRun: true }) }),
    CryptoModule,
    AuthModule,
    DomainModule,
    UsersModule,
    AccountsModule,
    CurrenciesModule,
    CategoriesModule,
    AmountItemsModule,
    PlansModule,
    ExpendituresModule,
    WishlistsModule,
    DailyExpensesModule,
  ],
  controllers: [HealthController],
  providers: [SeedService],
})
export class AppModule {}
