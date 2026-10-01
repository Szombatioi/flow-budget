import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { DataSource } from 'typeorm';
import { UserId } from '../auth/decorators.js';
import { notFound } from '../common/errors.js';
import { Account, Currency } from '../database/entities/index.js';
import { OwnershipService } from '../domain/ownership.service.js';

class CreateAccountDto {
  @IsString()
  @Length(1, 50)
  name: string;

  @IsString()
  @Length(3, 3)
  currencyCode: string;
}

class UpdateAccountDto {
  @IsString()
  @Length(1, 50)
  name: string;
}

export interface AccountDto {
  id: string;
  name: string;
  currencyCode: string;
}

export const toAccountDto = (a: Account): AccountDto => ({ id: a.id, name: a.name, currencyCode: a.currencyCode });

@Injectable()
export class AccountsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ownership: OwnershipService,
  ) {}

  async list(userId: string): Promise<AccountDto[]> {
    const accounts = await this.dataSource.getRepository(Account).find({ where: { userId }, order: { createdAt: 'ASC' } });
    return accounts.map(toAccountDto);
  }

  async create(userId: string, dto: CreateAccountDto): Promise<AccountDto> {
    const currencyCode = dto.currencyCode.toUpperCase();
    if (!(await this.dataSource.getRepository(Currency).existsBy({ code: currencyCode }))) throw notFound('currency_not_found');
    const account = await this.dataSource.getRepository(Account).save({ userId, name: dto.name.trim(), currencyCode });
    return toAccountDto(account);
  }

  async rename(userId: string, id: string, dto: UpdateAccountDto): Promise<void> {
    await this.ownership.account(userId, id);
    await this.dataSource.getRepository(Account).update({ id }, { name: dto.name.trim() });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.ownership.account(userId, id);
    await this.dataSource.getRepository(Account).delete({ id });
  }
}

@Controller('api/accounts')
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.service.list(userId);
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: CreateAccountDto) {
    return this.service.create(userId, dto);
  }

  @Put(':id')
  @HttpCode(204)
  rename(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAccountDto) {
    return this.service.rename(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(userId, id);
  }
}

@Module({ controllers: [AccountsController], providers: [AccountsService] })
export class AccountsModule {}
