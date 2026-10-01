import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  live() {
    return { status: 'Healthy' };
  }

  @Get('ready')
  async ready() {
    const started = performance.now();
    try {
      await this.dataSource.query('SELECT 1');
    } catch (err) {
      throw new ServiceUnavailableException({ error: 'database_unavailable', message: (err as Error).message });
    }
    return { status: 'Healthy', checks: [{ name: 'database', status: 'Healthy', durationMs: Math.round(performance.now() - started) }] };
  }
}
