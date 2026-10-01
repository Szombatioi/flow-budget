import { HttpStatus } from '@nestjs/common';
import { APIError } from 'better-auth/api';
import { AppError } from '../common/errors.js';

export async function withAuthErrors<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err) {
    if (err instanceof APIError) {
      const code = (err.body as { code?: string } | undefined)?.code?.toLowerCase() ?? 'auth_error';
      throw new AppError(HttpStatus.BAD_REQUEST, code, err.message);
    }
    throw err;
  }
}
