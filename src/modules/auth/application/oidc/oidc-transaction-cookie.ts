import { BadRequestException } from '@nestjs/common';
import { getRuntimeConfig } from '#config';

export function oidcTransactionCookieName(state: string): string {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(state)) throw new BadRequestException();
  const prefix = getRuntimeConfig().environment === 'production' ? '__Host-' : '';
  return `${prefix}aimeeting_oidc_${state}`;
}

export function serializeOidcTransactionCookie(state: string, value: string, clear = false): string {
  const secure = getRuntimeConfig().sessionCookieSecure ? '; Secure' : '';
  return `${oidcTransactionCookieName(state)}=${clear ? '' : encodeURIComponent(value)}; Path=/; Max-Age=${clear ? 0 : 300}; HttpOnly; SameSite=Lax${secure}`;
}
