import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { UserId } from '../auth/decorators.js';
import { badRequest } from '../common/errors.js';
import { IsDateOnly } from '../common/validation.js';
import { CreateExpendituresDto, ExpenditureQuery, StatsQuery, UpdateExpenditureDto } from './expenditures.dto.js';
import { ExpendituresService } from './expenditures.service.js';
import { EXPORT_FORMATS, type ExportFormat, ExportService } from './export.service.js';

class ExportDto {
  @IsUUID()
  accountId: string;

  @IsIn(EXPORT_FORMATS)
  format: ExportFormat;

  @IsDateOnly()
  from: string;

  @IsDateOnly()
  to: string;

  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  categoryIds: string[] = [];

  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  pocketIds: string[] = [];

  @IsOptional()
  @IsString()
  @MaxLength(3)
  separator?: string;
}

@Controller('api/expenditures')
export class ExpendituresController {
  constructor(
    private readonly service: ExpendituresService,
    private readonly exporter: ExportService,
  ) {}

  @Get()
  query(@UserId() userId: string, @Query() query: ExpenditureQuery) {
    return this.service.query(userId, query);
  }

  @Get('stats')
  stats(@UserId() userId: string, @Query() query: StatsQuery) {
    return this.service.stats(userId, query.accountId);
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: CreateExpendituresDto) {
    return this.service.addMany(userId, dto.items);
  }

  @Put(':id')
  @HttpCode(204)
  update(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExpenditureDto) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(userId, id);
  }

  @Post('export')
  @HttpCode(200)
  async export(@UserId() userId: string, @Body() dto: ExportDto, @Res() res: Response) {
    if (dto.from > dto.to) throw badRequest('invalid_date_range');
    const file = await this.exporter.export(userId, dto);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.buffer);
  }
}

@Module({
  controllers: [ExpendituresController],
  providers: [ExpendituresService, ExportService],
  exports: [ExpendituresService],
})
export class ExpendituresModule {}
