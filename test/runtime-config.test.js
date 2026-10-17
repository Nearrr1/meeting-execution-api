import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadRuntimeConfig } from '../dist/config/runtime-config.js';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3100',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  WEB_ORIGINS: 'https://web.example.com',
  OTP_HMAC_KEY: 'a-test-key-with-more-than-thirty-two-bytes',
  PASSWORD_RESET_URL: 'https://web.example.com/reset',
  EMAIL_CHANGE_URL: 'https://web.example.com/change',
  RESEND_API_KEY: 're_test',
  RESEND_FROM_EMAIL: 'test@example.com',
};

describe('runtime configuration', () => {
  it('parses valid settings and applies safe defaults', () => {
    const config = loadRuntimeConfig(validEnvironment);
    assert.equal(config.port, 3100);
    assert.deepEqual(config.webOrigins, ['https://web.example.com']);
    assert.equal(config.sessionCookieSameSite, 'lax');
    assert.equal(config.sessionCookieSecure, false);
  });

  it('reports invalid field names without exposing secret values', () => {
    const secret = 'short-secret-value';
    assert.throws(
      () => loadRuntimeConfig({ ...validEnvironment, OTP_HMAC_KEY: secret }),
      (error) => error.message.includes('OTP_HMAC_KEY') && !error.message.includes(secret),
    );
  });

  it('requires HTTPS and same-origin callback URLs in production', () => {
    assert.throws(
      () =>
        loadRuntimeConfig({
          ...validEnvironment,
          NODE_ENV: 'production',
          PASSWORD_RESET_URL: 'http://web.example.com/reset',
        }),
      /PASSWORD_RESET_URL/,
    );
    assert.throws(
      () => loadRuntimeConfig({ ...validEnvironment, EMAIL_CHANGE_URL: 'https://elsewhere.example/change' }),
      /EMAIL_CHANGE_URL/,
    );
  });

  it('rejects SameSite=None without Secure cookies', () => {
    assert.throws(
      () => loadRuntimeConfig({ ...validEnvironment, SESSION_COOKIE_SAME_SITE: 'none' }),
      /SESSION_COOKIE_SECURE/,
    );
  });

  it('requires a host-only session cookie name in production', () => {
    assert.throws(
      () =>
        loadRuntimeConfig({
          ...validEnvironment,
          NODE_ENV: 'production',
          SESSION_COOKIE_NAME: 'aimeeting_session',
        }),
      /SESSION_COOKIE_NAME/,
    );
  });

  it('accepts a complete OIDC configuration and rejects partial configuration', () => {
    const config = loadRuntimeConfig({
      ...validEnvironment,
      AUTH0_ISSUER: 'https://tenant.example.auth0.com/',
      AUTH0_CLIENT_ID: 'client-id',
      AUTH0_CLIENT_SECRET: 'client-secret',
      AUTH0_CALLBACK_URL: 'http://localhost:3000/api/v1/auth/oidc/callback',
      AUTH0_GOOGLE_CONNECTION: 'google-oauth2',
      AUTH0_MICROSOFT_CONNECTION: 'entra',
      OIDC_TRANSACTION_ENCRYPTION_KEY: '01234567890123456789012345678901',
    });
    assert.equal(config.oidc?.issuer, 'https://tenant.example.auth0.com/');
    assert.throws(() => loadRuntimeConfig({ ...validEnvironment, AUTH0_CLIENT_ID: 'client-id' }), /AUTH0_/);
  });
});
