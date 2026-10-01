import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUrl, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';
import { UserId } from '../auth/decorators.js';
import { IsDateOnly } from '../common/validation.js';
import { WishlistMode } from '../database/entities/index.js';
import { ExpendituresModule } from '../expenditures/expenditures.module.js';
import { WishlistsService } from './wishlists.service.js';

class CreateWishlistDto {
  @IsUUID()
  accountId: string;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  imageUrl?: string | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1e15)
  targetAmount: number;

  @IsDateOnly()
  targetDate: string;

  @IsEnum(WishlistMode)
  mode: WishlistMode;

  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  affectedDailyExpenseIds: string[] = [];
}

class MoveMoneyDto {
  @IsUUID()
  pocketId: string;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1e15)
  amount: number;

  @IsDateOnly()
  date: string;
}

@Controller('api/wishlists')
export class WishlistsController {
  constructor(private readonly service: WishlistsService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.service.list(userId);
  }

  @Get(':id')
  get(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(userId, id);
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: CreateWishlistDto) {
    return this.service.create(userId, dto);
  }

  @Post(':id/activate')
  @HttpCode(204)
  activate(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.setActive(userId, id, true);
  }

  @Post(':id/deactivate')
  @HttpCode(204)
  deactivate(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.setActive(userId, id, false);
  }

  @Delete('align/:dailyExpenseId')
  @HttpCode(204)
  unalign(@UserId() userId: string, @Param('dailyExpenseId', ParseUUIDPipe) dailyExpenseId: string) {
    return this.service.unalign(userId, dailyExpenseId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(userId, id);
  }

  @Post(':id/align/:dailyExpenseId')
  @HttpCode(204)
  align(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Param('dailyExpenseId', ParseUUIDPipe) dailyExpenseId: string) {
    return this.service.align(userId, id, dailyExpenseId);
  }

  @Post(':id/move')
  @HttpCode(201)
  move(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveMoneyDto) {
    return this.service.moveMoney(userId, id, dto);
  }
}

@Module({
  imports: [ExpendituresModule],
  controllers: [WishlistsController],
  providers: [WishlistsService],
  exports: [WishlistsService],
})
export class WishlistsModule {}
