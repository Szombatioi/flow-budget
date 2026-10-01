import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module.js';
import { AUTH, type Auth, runAuthMigrations } from './auth/auth.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { loadConfig } from './config/config.js';

async function bootstrap() {
  const config = loadConfig();
  await runAuthMigrations(config);

  // Better Auth parses its own request bodies, so the JSON parser is registered after its handler.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.set('trust proxy', true);
  app.getHttpAdapter().getInstance().all('/api/auth/*splat', toNodeHandler(app.get<Auth>(AUTH)));
  app.useBodyParser('json', { limit: '1mb' });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(config.port);
  Logger.log(`FlowBudget API listening on port ${config.port}`, 'Bootstrap');
}

await bootstrap();
