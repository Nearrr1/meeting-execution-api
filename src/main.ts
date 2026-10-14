import { ApiErrorCode } from '#common';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { ApiExceptionFilter } from '#common';
import { AppModule } from './app.module.ts';

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix('api/v1');
app.use((request: { requestId?: string }, response: { setHeader(name: string, value: string): void }, next: () => void) => {
  request.requestId = randomUUID();
  response.setHeader('X-Request-Id', request.requestId);
  next();
});
app.enableCors({
  origin: (process.env.WEB_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
});
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: () => new BadRequestException({ code: ApiErrorCode.INVALID_REQUEST }),
}));
app.useGlobalFilters(new ApiExceptionFilter());

const openApiDocument = parse(
  readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8'),
);
SwaggerModule.setup('docs', app, openApiDocument);

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
await app.listen(port, '0.0.0.0');
