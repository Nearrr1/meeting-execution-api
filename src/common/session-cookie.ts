import { randomBytes } from 'node:crypto';

export const sessionCookieName = (): string =>
  process.env.NODE_ENV === 'production'
    ? '__Host-aimeeting_session'
    : process.env.SESSION_COOKIE_NAME ?? 'aimeeting_session';

export const createSessionSecret = (): string => randomBytes(32).toString('base64url');

export function serializeSessionCookie(secret: string, maxAgeSeconds: number): string {
  const secure = process.env.SESSION_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const sameSite = (process.env.SESSION_COOKIE_SAME_SITE ?? 'lax').toLowerCase();
  if (sameSite === 'none' && !secure) throw new Error('SameSite=None requires Secure cookies');
  return `${sessionCookieName()}=${encodeURIComponent(secret)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=${sameSite}${secure ? '; Secure' : ''}`;
}
