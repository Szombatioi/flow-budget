import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import type { CategoryDto } from '../categories/categories.js';
import { IsDateOnly } from '../common/validation.js';

export class CreateExpenditureDto {
  @IsUUID()
  pocketId: string;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1e15)
  price: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsDateOnly()
  date?: string;
}

export class CreateExpendituresDto {
  @ValidateNested({ each: true })
  @Type(() => CreateExpenditureDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  items: CreateExpenditureDto[];
}

export class UpdateExpenditureDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1e15)
  price: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}

export class ExpenditureQuery {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pocketName?: string;

  @IsOptional()
  @IsDateOnly()
  from?: string;

  @IsOptional()
  @IsDateOnly()
  to?: string;

  @IsOptional()
  @IsIn(['date', 'price'])
  sortBy?: 'date' | 'price';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class StatsQuery {
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export interface ExpenditureDto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  date: string;
  createdAt: string;
  currency: string;
  category: CategoryDto | null;
  pocketId: string;
  pocketName: string;
  accountId: string;
  wishlistId: string | null;
  wishlistName: string | null;
}
