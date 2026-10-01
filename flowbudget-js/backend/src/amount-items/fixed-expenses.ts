import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserId } from '../auth/decorators.js';
import { FixedExpense } from '../database/entities/index.js';
import { BudgetService } from '../domain/budget.service.js';
import { OwnershipService } from '../domain/ownership.service.js';
import { CreateAmountItemDto, UpdateAmountItemDto } from './amount-items.dto.js';
import { AmountItemsService } from './amount-items.service.js';

@Injectable()
export class FixedExpensesService extends AmountItemsService {
  constructor(dataSource: DataSource, ownership: OwnershipService, budget: BudgetService) {
    super(FixedExpense, dataSource, ownership, budget);
  }
}

@Controller('api/fixed-expenses')
export class FixedExpensesController {
  constructor(private readonly service: FixedExpensesService) {}

  @Get(':accountId')
  list(@UserId() userId: string, @Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.service.list(userId, accountId);
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: CreateAmountItemDto) {
    return this.service.create(userId, dto);
  }

  @Put(':id')
  @HttpCode(204)
  update(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAmountItemDto) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(userId, id);
  }
}
