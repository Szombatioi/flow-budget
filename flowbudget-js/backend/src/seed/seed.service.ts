import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { Category, Currency } from '../database/entities/index.js';

const CURRENCIES = [
  { code: 'HUF', name: 'currency_huf', country: 'currency_country_huf' },
  { code: 'EUR', name: 'currency_eur', country: null },
];

const SYSTEM_CATEGORIES = [
  { name: 'Clothes', displayName: 'seeded_category_clothes' },
  { name: 'Foods/Drinks', displayName: 'seeded_category_foods_drinks' },
  { name: 'Sports and hobbies', displayName: 'seeded_category_sports_hobbies' },
  { name: 'Transportation', displayName: 'seeded_category_transportation' },
  { name: 'Housing', displayName: 'seeded_category_housing' },
];

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    await this.dataSource.createQueryBuilder().insert().into(Currency).values(CURRENCIES).orIgnore().execute();

    const categories = this.dataSource.getRepository(Category);
    for (const category of SYSTEM_CATEGORIES) {
      const exists = await categories.existsBy({ name: category.name, userId: IsNull() });
      if (!exists) await categories.insert({ ...category, userId: null });
    }
    this.logger.log('Seed data ensured');
  }
}
