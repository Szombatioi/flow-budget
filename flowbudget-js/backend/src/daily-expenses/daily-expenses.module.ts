import { Controller, Get, Module, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional } from 'class-validator';
import { UserId } from '../auth/decorators.js';
import { CategoriesModule } from '../categories/categories.js';
import { today } from '../common/dates.js';
import { badRequest } from '../common/errors.js';
import { IsDateOnly } from '../common/validation.js';
import { loadConfig } from '../config/config.js';
import { ExpendituresModule } from '../expenditures/expenditures.module.js';
import { UsersModule } from '../users/users.js';
import { WishlistsModule } from '../wishlists/wishlists.module.js';
import { DailyExpensesService } from './daily-expenses.service.js';
import { ReceiptService } from './receipt.service.js';

class DayQuery {
  @IsOptional()
  @IsDateOnly()
  date?: string;
}

class RangeQuery {
  @IsDateOnly()
  from: string;

  @IsDateOnly()
  to: string;
}

const ALLOWED_RECEIPT_TYPES = /^(image\/(png|jpe?g|webp|heic|heif)|application\/pdf)$/;

@Controller('api/daily-expenses')
export class DailyExpensesController {
  constructor(
    private readonly service: DailyExpensesService,
    private readonly receipts: ReceiptService,
  ) {}

  @Get(':pocketId')
  get(@UserId() userId: string, @Param('pocketId', ParseUUIDPipe) pocketId: string, @Query() query: DayQuery) {
    return this.service.get(userId, pocketId, query.date ?? today());
  }

  @Get(':pocketId/time-series')
  timeSeries(@UserId() userId: string, @Param('pocketId', ParseUUIDPipe) pocketId: string, @Query() q: RangeQuery) {
    return this.service.timeSeries(userId, pocketId, q.from, q.to);
  }

  @Get(':pocketId/budget-series')
  budgetSeries(@UserId() userId: string, @Param('pocketId', ParseUUIDPipe) pocketId: string, @Query() q: RangeQuery) {
    return this.service.budgetSeries(userId, pocketId, q.from, q.to);
  }

  @Get(':pocketId/in-range')
  inRange(@UserId() userId: string, @Param('pocketId', ParseUUIDPipe) pocketId: string, @Query() q: RangeQuery) {
    return this.service.inRange(userId, pocketId, q.from, q.to);
  }

  @Post(':pocketId/receipt')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: loadConfig().uploadMaxBytes } }))
  receipt(@UserId() userId: string, @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number }) {
    if (!file || file.size === 0) throw badRequest('file_missing');
    if (!ALLOWED_RECEIPT_TYPES.test(file.mimetype)) throw badRequest('unsupported_file_type');
    return this.receipts.scan(userId, file);
  }
}

@Module({
  imports: [ExpendituresModule, WishlistsModule, UsersModule, CategoriesModule],
  controllers: [DailyExpensesController],
  providers: [DailyExpensesService, ReceiptService],
})
export class DailyExpensesModule {}
