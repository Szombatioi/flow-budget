import { IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { IsMonthStart } from '../common/validation.js';

export class CreateAmountItemDto {
  @IsUUID()
  accountId: string;

  @IsString()
  @Length(1, 50)
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1e15)
  amount: number;
}

export class UpdateAmountItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1e15)
  amount?: number;

  @IsOptional()
  @IsMonthStart()
  from?: string;
}

export interface AmountItemDto {
  id: string;
  lineageId: string;
  name: string;
  amount: number;
  activeFrom: string;
  upcoming: { name: string; amount: number; activeFrom: string; isDeleted: boolean } | null;
}
