import { HttpException, HttpStatus } from '@nestjs/common';

// Error codes double as translation keys on the frontend.
export class AppError extends HttpException {
  constructor(status: HttpStatus, readonly code: string, message?: string) {
    super({ error: code, message: message ?? code }, status);
  }
}

export const notFound = (code = 'not_found') => new AppError(HttpStatus.NOT_FOUND, code);
export const conflict = (code: string, message?: string) => new AppError(HttpStatus.CONFLICT, code, message);
export const badRequest = (code: string, message?: string) => new AppError(HttpStatus.BAD_REQUEST, code, message);
export const forbidden = (code = 'forbidden') => new AppError(HttpStatus.FORBIDDEN, code);
