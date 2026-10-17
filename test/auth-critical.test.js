import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { after, describe, it } from 'node:test';
import 'reflect-metadata';
import { ApiErrorCode } from '../dist/common/api-error-code.enum.js';
import { AuthService } from '../dist/modules/auth/services/auth.service.js';
import { AccountLifecycleService } from '../dist/modules/auth/application/account-lifecycle/account-lifecycle.service.js';
import { OriginAndCsrfGuard, csrfCookieName } from '../dist/common/csrf.js';
import { SessionGuard } from '../dist/modules/auth/guards/session.guard.js';
import { initializeRuntimeConfig, resetRuntimeConfigForTests } from '../dist/config/runtime-config.js';

const testEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  WEB_ORIGINS: 'https://web.example.com',
  OTP_HMAC_KEY: 'test-key-with-at-least-32-characters-long',
  PASSWORD_RESET_URL: 'https://web.example.com/reset',
  EMAIL_CHANGE_URL: 'https://web.example.com/change',
  RESEND_API_KEY: 're_test',
  RESEND_FROM_EMAIL: 'test@example.com',
};
initializeRuntimeConfig(testEnvironment);

const originalOtpKey = process.env.OTP_HMAC_KEY;
const originalOrigins = process.env.WEB_ORIGINS;

after(() => {
  if (originalOtpKey === undefined) delete process.env.OTP_HMAC_KEY;
  else process.env.OTP_HMAC_KEY = originalOtpKey;
  if (originalOrigins === undefined) delete process.env.WEB_ORIGINS;
  else process.env.WEB_ORIGINS = originalOrigins;
  resetRuntimeConfigForTests();
});

function makeAuthService(prisma = {}) {
  return new AuthService(prisma, {}, {}, {}, {}, {});
}

function hasErrorCode(code) {
  return (error) => error?.getResponse?.()?.code === code;
}

function contextFor(request) {
  return { switchToHttp: () => ({ getRequest: () => request }) };
}

describe('critical authentication behavior', () => {
  it('rejects a weak registration password before accessing persistence', async () => {
    let databaseTouched = false;
    const service = makeAuthService({
      $transaction: async () => {
        databaseTouched = true;
      },
    });

    await assert.rejects(
      service.register(
        { email: 'user@example.com', password: 'weak', passwordConfirmation: 'weak' },
        '127.0.0.1',
        'request-1',
      ),
      hasErrorCode(ApiErrorCode.PASSWORD_POLICY_FAILED),
    );
    assert.equal(databaseTouched, false);
  });

  it('rejects a malformed password recovery token without querying persistence', async () => {
    let databaseTouched = false;
    const service = makeAuthService({
      authChallenge: {
        findFirst: async () => {
          databaseTouched = true;
          return null;
        },
      },
    });

    await assert.rejects(
      service.resetPassword(
        { token: 'short', newPassword: 'StrongPass1!', passwordConfirmation: 'StrongPass1!' },
        'request-2',
      ),
      hasErrorCode(ApiErrorCode.PASSWORD_RESET_INVALID),
    );
    assert.equal(databaseTouched, false);
  });

  it('uses the same generic sign-in error for unknown and unverified accounts', async () => {
    initializeRuntimeConfig(testEnvironment);

    for (const emailRecord of [
      null,
      {
        verifiedAt: null,
        account: { id: 'account-1', status: 'ACTIVE', localCredential: null },
      },
    ]) {
      const prisma = {
        rateLimitEvent: { count: async () => 0 },
        accountEmail: { findUnique: async () => emailRecord },
        $transaction: async (operation) =>
          operation({
            rateLimitEvent: { count: async () => 0, createMany: async () => ({ count: 2 }) },
            securityAuditEvent: { create: async () => ({}) },
          }),
      };
      const service = makeAuthService(prisma);

      await assert.rejects(
        service.signIn('missing@example.com', 'WrongPass1!', '127.0.0.1', 'request-3'),
        (error) => error?.getStatus?.() === 401 && hasErrorCode(ApiErrorCode.CREDENTIALS_INVALID)(error),
      );
    }
  });

  it('creates a session for a verified account with valid credentials', async () => {
    initializeRuntimeConfig(testEnvironment);
    const password = 'CorrectHorse1!';
    const salt = randomBytes(16);
    const passwordHash = `scrypt$32768$8$1$${salt.toString('base64url')}$${scryptSync(password, salt, 64, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    }).toString('base64url')}`;
    const emailRecord = {
      addressSubmitted: 'User@example.com',
      verifiedAt: new Date(),
      account: {
        id: 'account-2',
        displayName: 'User',
        status: 'ACTIVE',
        localCredential: { passwordHash },
        federatedIdentities: [],
      },
    };
    let sessionCreated = false;
    const service = makeAuthService({
      rateLimitEvent: { count: async () => 0 },
      accountEmail: {
        findUnique: async ({ where }) => {
          assert.equal(where.addressNormalized, 'user@example.com');
          return emailRecord;
        },
      },
      $transaction: async (operation) =>
        operation({
          account: { findUnique: async () => ({ status: 'ACTIVE' }) },
          authSession: {
            create: async () => {
              sessionCreated = true;
              return {};
            },
          },
          securityAuditEvent: { create: async () => ({}) },
        }),
    });

    const result = await service.signIn(' User@Example.com ', password, '127.0.0.1', 'request-5');

    assert.equal(sessionCreated, true);
    assert.equal(result.accountSession.account.id, 'account-2');
    assert.equal(result.accountSession.account.primaryEmail.address, 'User@example.com');
    assert.equal(typeof result.sessionToken, 'string');
    assert.ok(result.sessionToken.length >= 32);
  });

  it('requires recent reauthentication before disabling an account', async () => {
    let accountChanged = false;
    const service = new AccountLifecycleService({
      $transaction: async (operation) =>
        operation({
          authSession: { findFirst: async () => null },
          account: {
            updateMany: async () => {
              accountChanged = true;
            },
          },
        }),
    });

    await assert.rejects(
      service.disableAccount('account-1', 'session-1', 'request-4'),
      hasErrorCode(ApiErrorCode.REAUTHENTICATION_REQUIRED),
    );
    assert.equal(accountChanged, false);
  });

  it('rejects a browser mutation with a mismatched CSRF token', () => {
    initializeRuntimeConfig(testEnvironment);
    const request = {
      method: 'POST',
      headers: {
        origin: 'https://web.example.com',
        cookie: `${csrfCookieName()}=cookie-token`,
        'x-csrf-token': 'different-token',
      },
    };
    const guard = new OriginAndCsrfGuard();

    assert.throws(
      () => guard.canActivate(contextFor(request)),
      (error) => error?.getStatus?.() === 403 && hasErrorCode(ApiErrorCode.CSRF_VALIDATION_FAILED)(error),
    );
  });

  it('rejects protected session routes when the session cookie is missing', async () => {
    const guard = new SessionGuard({});

    await assert.rejects(
      guard.canActivate(contextFor({ headers: {} })),
      (error) => error?.getStatus?.() === 401 && hasErrorCode(ApiErrorCode.SESSION_INVALID)(error),
    );
  });
});
