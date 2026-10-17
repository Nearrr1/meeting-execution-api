import { ApiErrorCode, StructuredLogger } from '#common';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { ApiExceptionFilter } from '#common';
import { AppModule } from './app.module.ts';
import { initializeRuntimeConfig } from './config/index.ts';

const config = initializeRuntimeConfig();
const logger = new StructuredLogger();
const app = await NestFactory.create(AppModule, { logger });
app.setGlobalPrefix('api/v1');
app.use(
  (
    request: { requestId?: string },
    response: { setHeader(name: string, value: string): void },
    next: () => void,
  ) => {
    request.requestId = randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    next();
  },
);
app.enableCors({
  origin: config.webOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
});
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: () => new BadRequestException({ code: ApiErrorCode.INVALID_REQUEST }),
  }),
);
app.useGlobalFilters(new ApiExceptionFilter(logger));

const openApiDocument = parse(readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8'));
SwaggerModule.setup('docs', app, openApiDocument);

await app.listen(config.port, '0.0.0.0');
