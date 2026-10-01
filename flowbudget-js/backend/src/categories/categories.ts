import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { DataSource } from 'typeorm';
import { UserId } from '../auth/decorators.js';
import { notFound } from '../common/errors.js';
import { Category } from '../database/entities/index.js';

class CategoryNameDto {
  @IsString()
  @Length(1, 50)
  name: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
}

export const toCategoryDto = (c: Category): CategoryDto => ({ id: c.id, name: c.name, displayName: c.displayName, isSystem: c.userId === null });

@Injectable()
export class CategoriesService {
  constructor(private readonly dataSource: DataSource) {}

  async list(userId: string): Promise<CategoryDto[]> {
    const categories = await this.dataSource
      .getRepository(Category)
      .createQueryBuilder('c')
      .where('c.userId IS NULL OR c.userId = :userId', { userId })
      .orderBy('c.userId IS NULL', 'DESC')
      .addOrderBy('c.name', 'ASC')
      .getMany();
    return categories.map(toCategoryDto);
  }

  async create(userId: string, dto: CategoryNameDto): Promise<CategoryDto> {
    const name = dto.name.trim();
    return toCategoryDto(await this.dataSource.getRepository(Category).save({ name, displayName: name, userId }));
  }

  // System categories (userId = null) are read-only, so they never match here.
  async rename(userId: string, id: string, dto: CategoryNameDto): Promise<void> {
    const name = dto.name.trim();
    const result = await this.dataSource.getRepository(Category).update({ id, userId }, { name, displayName: name });
    if (!result.affected) throw notFound('category_not_found');
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.dataSource.getRepository(Category).delete({ id, userId });
    if (!result.affected) throw notFound('category_not_found');
  }
}

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.service.list(userId);
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: CategoryNameDto) {
    return this.service.create(userId, dto);
  }

  @Put(':id')
  @HttpCode(204)
  rename(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoryNameDto) {
    return this.service.rename(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(userId, id);
  }
}

@Module({ controllers: [CategoriesController], providers: [CategoriesService], exports: [CategoriesService] })
export class CategoriesModule {}
