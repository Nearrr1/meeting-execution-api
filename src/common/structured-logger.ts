import type { LoggerService } from '@nestjs/common';

export class StructuredLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  info(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(level: string, message: unknown, optionalParams: unknown[]): void {
    const context = [...optionalParams].reverse().find((value) => typeof value === 'string');
    const record: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      ...(context ? { context } : {}),
    };

    if (message && typeof message === 'object' && !(message instanceof Error)) Object.assign(record, message);
    else if (message instanceof Error) record.message = message.name;
    else record.message = String(message);

    let line: string;
    try {
      line = `${JSON.stringify(record)}\n`;
    } catch {
      line = `${JSON.stringify({ timestamp: record.timestamp, level, message: '[unserializable log record]' })}\n`;
    }
    (level === 'error' || level === 'fatal' ? process.stderr : process.stdout).write(line);
  }
}
