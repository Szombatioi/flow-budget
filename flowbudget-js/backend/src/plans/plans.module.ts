import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { UserId } from '../auth/decorators.js';
import { today } from '../common/dates.js';
import { IsDateOnly, IsMonthStart } from '../common/validation.js';
import { PlansService } from './plans.service.js';
import { PocketsService } from './pockets.service.js';

class CreatePlanDto {
  @IsUUID()
  accountId: string;

  @IsString()
  @Length(1, 100)
  name: string;
}

class RenamePlanDto {
  @IsString()
  @Length(1, 100)
  name: string;
}

class ActivatePlanDto {
  @IsMonthStart()
  from: string;
}

class EffectivePlanQuery {
  @IsOptional()
  @IsDateOnly()
  date?: string;
}

class CreatePocketDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  ration: number;

  @IsOptional()
  @IsMonthStart()
  from?: string;
}

class UpdatePocketDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ration?: number;

  @IsOptional()
  @IsMonthStart()
  from?: string;
}

class DeletePocketQuery {
  @IsOptional()
  @IsUUID()
  targetPocketId?: string;
}

@Controller('api/plans')
export class PlansController {
  constructor(private readonly service: PlansService) {}

  @Get(':accountId')
  list(@UserId() userId: string, @Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.service.list(userId, accountId);
  }

  @Get(':accountId/effective')
  effective(@UserId() userId: string, @Param('accountId', ParseUUIDPipe) accountId: string, @Query() query: EffectivePlanQuery) {
    return this.service.effective(userId, accountId, query.date ?? today());
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: CreatePlanDto) {
    return this.service.create(userId, dto.accountId, dto.name);
  }

  @Put(':id')
  @HttpCode(204)
  rename(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RenamePlanDto) {
    return this.service.rename(userId, id, dto.name);
  }

  @Post(':id/activate')
  @HttpCode(204)
  activate(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ActivatePlanDto) {
    return this.service.activate(userId, id, dto.from);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(userId, id);
  }
}

@Controller('api/pockets')
export class PocketsController {
  constructor(private readonly service: PocketsService) {}

  @Get(':planId')
  list(@UserId() userId: string, @Param('planId', ParseUUIDPipe) planId: string) {
    return this.service.list(userId, planId);
  }

  @Post(':planId')
  create(@UserId() userId: string, @Param('planId', ParseUUIDPipe) planId: string, @Body() dto: CreatePocketDto) {
    return this.service.create(userId, planId, dto);
  }

  @Put(':id')
  @HttpCode(204)
  update(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePocketDto) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Query() query: DeletePocketQuery) {
    return this.service.remove(userId, id, query.targetPocketId);
  }
}

@Module({ controllers: [PlansController, PocketsController], providers: [PlansService, PocketsService] })
export class PlansModule {}
