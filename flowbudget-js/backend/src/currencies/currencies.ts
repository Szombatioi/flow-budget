import { Controller, Get, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Currency } from '../database/entities/index.js';

@Controller('api/currencies')
export class CurrenciesController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async list() {
    const currencies = await this.dataSource.getRepository(Currency).find({ order: { code: 'ASC' } });
    return currencies.map(({ code, name, country }) => ({ code, name, country }));
  }
}

@Module({ controllers: [CurrenciesController] })
export class CurrenciesModule {}
