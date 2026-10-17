import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  LoggerService,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { ApiErrorCode } from './api-error-code.enum.ts';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService = new Logger(ApiExceptionFilter.name)) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const suppliedCode = typeof body === 'object' && body !== null && 'code' in body ? body.code : undefined;
    const code = typeof suppliedCode === 'string' ? suppliedCode : this.defaultCode(status);
    const requestId = request.requestId ?? randomUUID();

    if (status >= 500) {
      this.logger.error({
        event: 'http_request_failed',
        requestId,
        status,
        exceptionType: exception instanceof Error ? exception.name : typeof exception,
      });
    }

    response.setHeader('X-Request-Id', requestId);
    response.status(status).json({
      error: {
        code,
        message: status >= 500 ? 'Request could not be completed' : 'Request is invalid or not permitted',
        requestId,
      },
    });
  }

  private defaultCode(status: number): ApiErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ApiErrorCode.INVALID_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ApiErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ApiErrorCode.FORBIDDEN;
      case HttpStatus.CONFLICT:
        return ApiErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ApiErrorCode.RATE_LIMITED;
      default:
        return ApiErrorCode.INTERNAL_ERROR;
    }
  }
}
