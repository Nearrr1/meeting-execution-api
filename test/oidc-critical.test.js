import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { initializeRuntimeConfig, resetRuntimeConfigForTests } from '../dist/config/runtime-config.js';
import { OidcService } from '../dist/modules/auth/application/oidc/oidc.service.js';
import {
  oidcTransactionCookieName,
  serializeOidcTransactionCookie,
} from '../dist/modules/auth/application/oidc/oidc-transaction-cookie.js';

const environment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  WEB_ORIGINS: 'https://web.example.com',
  OTP_HMAC_KEY: 'test-key-with-at-least-32-characters-long',
  PASSWORD_RESET_URL: 'https://web.example.com/reset',
  EMAIL_CHANGE_URL: 'https://web.example.com/change',
  RESEND_API_KEY: 're_test',
  RESEND_FROM_EMAIL: 'test@example.com',
  AUTH0_ISSUER: 'https://tenant.example.auth0.com/',
  AUTH0_CLIENT_ID: 'client-id',
  AUTH0_CLIENT_SECRET: 'client-secret',
  AUTH0_CALLBACK_URL: 'http://localhost:3000/api/v1/auth/oidc/callback',
  AUTH0_GOOGLE_CONNECTION: 'google-oauth2',
  AUTH0_MICROSOFT_CONNECTION: 'entra',
  OIDC_TRANSACTION_ENCRYPTION_KEY: '01234567890123456789012345678901',
};

describe('OIDC security boundaries', () => {
  it('requires a signed-in account for explicit linking', async () => {
    initializeRuntimeConfig(environment);
    const service = new OidcService({});
    await assert.rejects(service.start('google', 'link'), (error) => error?.getStatus?.() === 401);
    resetRuntimeConfigForTests();
  });

  it('rejects an invalid callback without looking up a transaction', async () => {
    initializeRuntimeConfig(environment);
    let databaseTouched = false;
    const service = new OidcService({
      oidcTransaction: {
        findUnique: async () => {
          databaseTouched = true;
          return null;
        },
      },
    });
    await assert.rejects(
      service.complete(new URL('http://localhost:3000/api/v1/auth/oidc/callback'), 'request-1', undefined),
      (error) => error?.getStatus?.() === 400,
    );
    assert.equal(databaseTouched, false);
    resetRuntimeConfigForTests();
  });

  it('checks the browser binding before consuming an OIDC transaction', async () => {
    initializeRuntimeConfig(environment);
    const state = 'oidc-state-1234567890';
    const expectedBinding = 'correct-browser-binding';
    let consumed = false;
    const service = new OidcService({
      oidcTransaction: {
        findUnique: async () => ({
          id: 'transaction-1',
          browserBindingHash: createHash('sha256').update(expectedBinding).digest('hex'),
          consumedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          intent: 'signin',
          provider: 'google',
        }),
        updateMany: async () => {
          consumed = true;
          return { count: 1 };
        },
      },
    });
    await assert.rejects(
      service.complete(
        new URL(`http://localhost:3000/api/v1/auth/oidc/callback?code=auth-code&state=${state}`),
        'request-2',
        'different-browser-binding',
      ),
      (error) => error?.getStatus?.() === 400,
    );
    assert.equal(consumed, false);
    resetRuntimeConfigForTests();
  });

  it('rejects paths that could escape the first-party origin', async () => {
    initializeRuntimeConfig(environment);
    const service = new OidcService({});
    await assert.rejects(
      service.start('google', 'signin', undefined, '//attacker.example'),
      (error) => error?.getStatus?.() === 400,
    );
    resetRuntimeConfigForTests();
  });

  it('binds short-lived OIDC cookies to the host and state', () => {
    initializeRuntimeConfig(environment);
    const state = 'state-value-1234567890';
    const cookie = serializeOidcTransactionCookie(state, 'binding-secret');
    assert.equal(oidcTransactionCookieName(state), `aimeeting_oidc_${state}`);
    assert.match(cookie, /HttpOnly; SameSite=Lax/);
    assert.match(cookie, /Max-Age=300/);
    assert.doesNotMatch(cookie, /Secure/);
    assert.match(serializeOidcTransactionCookie(state, '', true), /Max-Age=0/);
    resetRuntimeConfigForTests();
  });
});
