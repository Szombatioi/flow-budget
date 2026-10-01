import { Global, Module } from '@nestjs/common';
import { BudgetService } from './budget.service.js';
import { OwnershipService } from './ownership.service.js';

@Global()
@Module({
  providers: [BudgetService, OwnershipService],
  exports: [BudgetService, OwnershipService],
})
export class DomainModule {}
