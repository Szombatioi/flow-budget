import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (status >= 500) this.logger.error(`${req.method} ${req.url}`, exception.stack);
      res.status(status).json(typeof body === 'string' ? { error: body, message: body } : normalize(body));
      return;
    }

    this.logger.error(`Unhandled error on ${req.method} ${req.url}`, (exception as Error)?.stack ?? String(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'internal_error', message: 'An unexpected error occurred.' });
  }
}

function normalize(body: object): object {
  const b = body as { error?: unknown; message?: unknown };
  // Nest's built-in validation errors: { message: string[], error: 'Bad Request' }
  if (Array.isArray(b.message)) return { error: 'validation_failed', message: b.message.join('; ') };
  if (typeof b.error === 'string' && /^[a-z_]+$/.test(b.error)) return body;
  return { error: 'request_failed', message: typeof b.message === 'string' ? b.message : 'Request failed' };
}
