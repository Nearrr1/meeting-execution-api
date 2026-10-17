import { randomBytes } from 'node:crypto';
import { getRuntimeConfig } from '../config/index.ts';

export const sessionCookieName = (): string => getRuntimeConfig().sessionCookieName;

export const createSessionSecret = (): string => randomBytes(32).toString('base64url');

export function serializeSessionCookie(secret: string, maxAgeSeconds: number): string {
  const config = getRuntimeConfig();
  const secure = config.sessionCookieSecure;
  const sameSite = config.sessionCookieSameSite;
  if (sameSite === 'none' && !secure) throw new Error('SameSite=None requires Secure cookies');
  return `${sessionCookieName()}=${encodeURIComponent(secret)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=${sameSite}${secure ? '; Secure' : ''}`;
}
