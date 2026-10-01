import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isValidDateStr } from './dates.js';

export function IsDateOnly(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isDateOnly',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be a date in YYYY-MM-DD format`, ...options },
      validator: { validate: (value: unknown) => typeof value === 'string' && isValidDateStr(value) },
    });
}

export function IsMonthStart(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isMonthStart',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be the first day of a month (YYYY-MM-01)`, ...options },
      validator: { validate: (value: unknown) => typeof value === 'string' && isValidDateStr(value) && value.endsWith('-01') },
    });
}
