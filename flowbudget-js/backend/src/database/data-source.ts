import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { entities } from './entities/index.js';

if (existsSync('.env')) process.loadEnvFile('.env');

export function dataSourceOptions(): DataSourceOptions {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Missing required environment variable: DATABASE_URL');
  return {
    type: 'postgres',
    url,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities,
    migrations: [new URL('./migrations/*.js', import.meta.url).pathname],
    uuidExtension: 'pgcrypto',
    synchronize: false,
    logging: ['error', 'warn'],
  };
}

export default new DataSource(dataSourceOptions());
