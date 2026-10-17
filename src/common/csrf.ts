import { ApiErrorCode } from './api-error-code.enum.ts';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { sessionCookieName } from './session-cookie.ts';
import { getRuntimeConfig } from '../config/index.ts';

export const csrfCookieName = (): string =>
  getRuntimeConfig().environment === 'production' ? '__Host-aimeeting_csrf' : 'aimeeting_csrf';

export const cookieValue = (request: Request, name: string): string | undefined => {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== 'string') return undefined;

  const matches = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return undefined;
  try {
    return decodeURIComponent(matches[0]!.slice(name.length + 1));
  } catch {
    return undefined;
  }
};

export const newCsrfToken = (): string => randomBytes(32).toString('base64url');

export const csrfCookie = (token: string): string => {
  const config = getRuntimeConfig();
  const secure = config.sessionCookieSecure;
  const sameSite = config.sessionCookieSameSite;
  if (sameSite === 'none' && !secure) throw new Error('SameSite=None requires Secure cookies');
  return `${csrfCookieName()}=${encodeURIComponent(token)}; Path=/; Max-Age=3600; HttpOnly; SameSite=${sameSite}${secure ? '; Secure' : ''}`;
};

@Injectable()
export class OriginAndCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return true;

    const origin = request.headers.origin;
    if (typeof origin !== 'string') {
      if (cookieValue(request, sessionCookieName())) {
        throw new ForbiddenException({ code: ApiErrorCode.ORIGIN_REQUIRED });
      }
      return true;
    }
    const allowed = getRuntimeConfig().webOrigins;
    if (!allowed.includes(origin)) throw new ForbiddenException({ code: ApiErrorCode.ORIGIN_NOT_ALLOWED });

    const cookieToken = cookieValue(request, csrfCookieName());
    const headerToken = request.headers['x-csrf-token'];
    if (!cookieToken || typeof headerToken !== 'string') {
      throw new ForbiddenException({ code: ApiErrorCode.CSRF_VALIDATION_FAILED });
    }
    const expected = createHash('sha256').update(cookieToken).digest();
    const received = createHash('sha256').update(headerToken).digest();
    if (!timingSafeEqual(expected, received) || expected.length !== received.length) {
      throw new ForbiddenException({ code: ApiErrorCode.CSRF_VALIDATION_FAILED });
    }
    return true;
  }
}
