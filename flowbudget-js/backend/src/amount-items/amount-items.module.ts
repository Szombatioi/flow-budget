import { Module } from '@nestjs/common';
import { FixedExpensesController, FixedExpensesService } from './fixed-expenses.js';
import { IncomesController, IncomesService } from './incomes.js';

@Module({
  controllers: [IncomesController, FixedExpensesController],
  providers: [IncomesService, FixedExpensesService],
})
export class AmountItemsModule {}
