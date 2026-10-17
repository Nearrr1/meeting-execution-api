import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as oidc from 'openid-client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { isEmail } from 'class-validator';
import { ApiErrorCode, createSessionSecret, TimeUnitMs } from '#common';
import { PrismaService, withSerializableTransaction } from '#database';
import { getRuntimeConfig } from '#config';
import type { AuthenticatedRequest } from '../../guards/index.ts';

const OIDC_TRANSACTION_TTL_MS = 5 * TimeUnitMs.MINUTE;
const SESSION_IDLE_MS = 7 * TimeUnitMs.DAY;
const SESSION_ABSOLUTE_MS = 30 * TimeUnitMs.DAY;
const REAUTHENTICATION_WINDOW_MS = 10 * TimeUnitMs.MINUTE;

type OidcProvider = 'google' | 'microsoft';
type OidcIntent = 'signin' | 'link' | 'reauth';

interface OidcTransactionSecrets {
  nonce: string;
  codeVerifier: string;
}

@Injectable()
export class OidcService {
  private clientConfig?: Promise<oidc.Configuration>;

  constructor(private readonly prisma: PrismaService) {}

  async start(
    provider: OidcProvider,
    intent: OidcIntent,
    authSession?: Pick<NonNullable<AuthenticatedRequest['authSession']>, 'id' | 'accountId'>,
    returnTo?: string,
  ): Promise<{ authorizationUrl: string; state: string; browserBinding: string }> {
    const config = this.requireConfig();
    if ((intent === 'link' || intent === 'reauth') && !authSession) {
      throw new UnauthorizedException({ code: ApiErrorCode.SESSION_INVALID });
    }
    const safeReturnTo = safeReturnPath(returnTo, config.webOrigins[0]!);
    const now = new Date();
    await this.prisma.oidcTransaction.deleteMany({ where: { expiresAt: { lte: now } } });
    if (intent === 'link')
      await this.requireRecentReauthentication(authSession!.accountId, authSession!.id, now);
    if (intent === 'reauth') {
      const linked = await this.prisma.federatedIdentity.count({
        where: { accountId: authSession!.accountId, provider },
      });
      if (linked === 0) throw new UnauthorizedException({ code: ApiErrorCode.CREDENTIALS_INVALID });
    }

    const state = oidc.randomState();
    const browserBinding = randomBytes(32).toString('base64url');
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const secretCiphertext = encryptSecrets({ nonce, codeVerifier }, config.oidc!.transactionEncryptionKey);

    await this.prisma.oidcTransaction.create({
      data: {
        stateHash: hash(state),
        browserBindingHash: hash(browserBinding),
        provider,
        intent,
        accountId: intent === 'signin' ? null : authSession!.accountId,
        sessionId: intent === 'signin' ? null : authSession!.id,
        secretCiphertext,
        returnTo: safeReturnTo,
        expiresAt: new Date(now.getTime() + OIDC_TRANSACTION_TTL_MS),
      },
    });

    const discovery = await this.getClientConfig();
    const connection =
      provider === 'google' ? config.oidc!.googleConnection : config.oidc!.microsoftConnection;
    const authorizationUrl = oidc.buildAuthorizationUrl(discovery, {
      redirect_uri: config.oidc!.callbackUrl,
      scope: 'openid email profile',
      response_type: 'code',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      connection,
    }).href;
    return { authorizationUrl, state, browserBinding };
  }

  async complete(
    callbackUrl: URL,
    requestId: string,
    browserBinding: string | undefined,
  ): Promise<{ redirectTo: string; sessionToken?: string }> {
    const config = this.requireConfig();
    const state = callbackUrl.searchParams.get('state');
    const code = callbackUrl.searchParams.get('code');
    if (!state || !code || callbackUrl.searchParams.has('error')) {
      throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
    }

    const transaction = await this.prisma.oidcTransaction.findUnique({ where: { stateHash: hash(state) } });
    const now = new Date();
    if (
      !transaction ||
      transaction.consumedAt ||
      transaction.expiresAt <= now ||
      !browserBinding ||
      transaction.browserBindingHash !== hash(browserBinding)
    ) {
      throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
    }
    if (
      !['signin', 'link', 'reauth'].includes(transaction.intent) ||
      !['google', 'microsoft'].includes(transaction.provider)
    ) {
      throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
    }
    const consumed = await this.prisma.oidcTransaction.updateMany({
      where: { id: transaction.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });

    let secrets: OidcTransactionSecrets;
    let claims: oidc.IDToken;
    try {
      secrets = decryptSecrets(transaction.secretCiphertext, config.oidc!.transactionEncryptionKey);
      const tokenResponse = await oidc.authorizationCodeGrant(await this.getClientConfig(), callbackUrl, {
        expectedState: state,
        expectedNonce: secrets.nonce,
        pkceCodeVerifier: secrets.codeVerifier,
        idTokenExpected: true,
      });
      const verifiedClaims = tokenResponse.claims();
      if (!verifiedClaims) throw new Error('ID token claims missing');
      claims = verifiedClaims;
    } catch {
      throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
    }

    if (claims.iss !== config.oidc!.issuer || typeof claims.sub !== 'string' || claims.sub.length === 0) {
      throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
    }

    const provider = transaction.provider as OidcProvider;
    if (transaction.intent === 'link') {
      await this.bindIdentity(transaction, provider, claims, now, requestId);
      return { redirectTo: resolveReturnTo(transaction.returnTo, config.webOrigins[0]!) };
    }
    if (transaction.intent === 'reauth') {
      await this.reauthenticateSession(transaction, provider, claims, now, requestId);
      return { redirectTo: resolveReturnTo(transaction.returnTo, config.webOrigins[0]!) };
    }

    const sessionToken = await this.signIn(provider, claims, now, requestId);
    return { redirectTo: resolveReturnTo(transaction.returnTo, config.webOrigins[0]!), sessionToken };
  }

  private requireConfig() {
    const config = getRuntimeConfig();
    if (!config.oidc)
      throw new InternalServerErrorException({ code: ApiErrorCode.AUTHENTICATION_NOT_CONFIGURED });
    return config;
  }

  private getClientConfig(): Promise<oidc.Configuration> {
    if (!this.clientConfig) {
      const config = this.requireConfig().oidc!;
      this.clientConfig = oidc.discovery(
        new URL(config.issuer),
        config.clientId,
        undefined,
        oidc.ClientSecretPost(config.clientSecret),
      );
    }
    return this.clientConfig;
  }

  private async requireRecentReauthentication(
    accountId: string,
    sessionId: string,
    now: Date,
  ): Promise<void> {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        accountId,
        revokedAt: null,
        idleExpiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      select: { reauthenticatedAt: true },
    });
    if (
      !session?.reauthenticatedAt ||
      now.getTime() - session.reauthenticatedAt.getTime() > REAUTHENTICATION_WINDOW_MS
    ) {
      throw new UnauthorizedException({ code: ApiErrorCode.REAUTHENTICATION_REQUIRED });
    }
  }

  private async bindIdentity(
    transaction: { accountId: string | null; sessionId: string | null; requestId?: string },
    provider: OidcProvider,
    claims: oidc.IDToken,
    now: Date,
    requestId: string,
  ): Promise<void> {
    if (!transaction.accountId || !transaction.sessionId) {
      throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
    }
    await this.requireRecentReauthentication(transaction.accountId, transaction.sessionId, now);
    const existing = await this.prisma.federatedIdentity.findUnique({
      where: { issuer_subject: { issuer: claims.iss!, subject: claims.sub! } },
      select: { accountId: true },
    });
    if (existing) throw new ConflictException({ code: ApiErrorCode.CONFLICT });
    const validProviderEmail =
      typeof claims.email === 'string' && isEmail(claims.email) ? claims.email.trim() : null;
    const providerEmailVerified = claims.email_verified === true && validProviderEmail !== null;
    try {
      await withSerializableTransaction(this.prisma, async (db) => {
        const account = await db.account.findUnique({
          where: { id: transaction.accountId! },
          select: { status: true },
        });
        const session = await db.authSession.findFirst({
          where: {
            id: transaction.sessionId!,
            accountId: transaction.accountId!,
            revokedAt: null,
            idleExpiresAt: { gt: now },
            absoluteExpiresAt: { gt: now },
          },
          select: { reauthenticatedAt: true },
        });
        if (
          account?.status !== 'ACTIVE' ||
          !session?.reauthenticatedAt ||
          now.getTime() - session.reauthenticatedAt.getTime() > REAUTHENTICATION_WINDOW_MS
        ) {
          throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
        }
        await db.federatedIdentity.create({
          data: {
            accountId: transaction.accountId!,
            issuer: claims.iss!,
            subject: claims.sub!,
            provider,
            providerEmail: providerEmailVerified ? validProviderEmail : null,
            providerEmailVerified,
          },
        });
        await db.securityAuditEvent.create({
          data: {
            accountId: transaction.accountId!,
            eventType: 'federated_identity_link',
            outcome: 'succeeded',
            requestId,
          },
        });
      });
    } catch (error) {
      if (isUniqueConflict(error)) throw new ConflictException({ code: ApiErrorCode.CONFLICT });
      throw error;
    }
  }

  private async reauthenticateSession(
    transaction: { accountId: string | null; sessionId: string | null },
    provider: OidcProvider,
    claims: oidc.IDToken,
    now: Date,
    requestId: string,
  ): Promise<void> {
    if (
      !transaction.accountId ||
      !transaction.sessionId ||
      typeof claims.iss !== 'string' ||
      typeof claims.sub !== 'string'
    ) {
      throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
    }
    const accountId = transaction.accountId;
    const sessionId = transaction.sessionId;
    const identity = await this.prisma.federatedIdentity.findUnique({
      where: { issuer_subject: { issuer: claims.iss, subject: claims.sub } },
      select: { accountId: true, provider: true },
    });
    if (identity?.accountId !== accountId || identity.provider !== provider) {
      throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
    }
    await withSerializableTransaction(this.prisma, async (db) => {
      const activeSession = await db.authSession.findFirst({
        where: {
          id: sessionId,
          accountId,
          revokedAt: null,
          idleExpiresAt: { gt: now },
          absoluteExpiresAt: { gt: now },
          account: { status: 'ACTIVE' },
        },
        select: { id: true },
      });
      if (!activeSession) throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
      const updated = await db.authSession.updateMany({
        where: {
          id: sessionId,
          accountId,
          revokedAt: null,
          idleExpiresAt: { gt: now },
          absoluteExpiresAt: { gt: now },
        },
        data: { reauthenticatedAt: now },
      });
      if (updated.count !== 1) throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
      await db.securityAuditEvent.create({
        data: {
          accountId,
          eventType: 'federated_reauthentication',
          outcome: 'succeeded',
          requestId,
        },
      });
    });
  }

  async listIdentities(accountId: string) {
    const [account, identities] = await Promise.all([
      this.prisma.account.findUnique({
        where: { id: accountId },
        select: { localCredential: { select: { accountId: true } } },
      }),
      this.prisma.federatedIdentity.findMany({
        where: { accountId },
        orderBy: { linkedAt: 'asc' },
        select: {
          id: true,
          provider: true,
          providerEmail: true,
          providerEmailVerified: true,
          linkedAt: true,
        },
      }),
    ]);
    return {
      identities: [
        ...(account?.localCredential
          ? [{ id: `local:${accountId}`, provider: 'local', label: 'Password' }]
          : []),
        ...identities.map((identity) => ({
          id: identity.id,
          provider: identity.provider,
          label: maskEmail(identity.providerEmail ?? ''),
          verified: identity.providerEmailVerified,
          linkedAt: identity.linkedAt,
        })),
      ],
    };
  }

  async unlinkIdentity(
    accountId: string,
    sessionId: string,
    identityId: string,
    requestId: string,
  ): Promise<void> {
    const now = new Date();
    await withSerializableTransaction(this.prisma, async (db) => {
      const [account, session, identity, linkedCount] = await Promise.all([
        db.account.findUnique({
          where: { id: accountId },
          select: { status: true, localCredential: { select: { accountId: true } } },
        }),
        db.authSession.findFirst({
          where: {
            id: sessionId,
            accountId,
            revokedAt: null,
            idleExpiresAt: { gt: now },
            absoluteExpiresAt: { gt: now },
          },
          select: { reauthenticatedAt: true },
        }),
        db.federatedIdentity.findFirst({ where: { id: identityId, accountId }, select: { id: true } }),
        db.federatedIdentity.count({ where: { accountId } }),
      ]);
      if (account?.status !== 'ACTIVE' || !session) {
        throw new UnauthorizedException({ code: ApiErrorCode.SESSION_INVALID });
      }
      if (
        !session.reauthenticatedAt ||
        now.getTime() - session.reauthenticatedAt.getTime() > REAUTHENTICATION_WINDOW_MS
      ) {
        throw new UnauthorizedException({ code: ApiErrorCode.REAUTHENTICATION_REQUIRED });
      }
      if (!identity) return;
      if (!account.localCredential && linkedCount <= 1) {
        throw new ConflictException({ code: ApiErrorCode.LAST_SIGN_IN_METHOD });
      }
      const deleted = await db.federatedIdentity.deleteMany({ where: { id: identity.id, accountId } });
      if (deleted.count === 1) {
        await db.securityAuditEvent.create({
          data: { accountId, eventType: 'federated_identity_unlink', outcome: 'succeeded', requestId },
        });
      }
    });
  }

  private async signIn(
    provider: OidcProvider,
    claims: oidc.IDToken,
    now: Date,
    requestId: string,
  ): Promise<string> {
    if (typeof claims.iss !== 'string' || typeof claims.sub !== 'string') {
      throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
    }
    const sessionToken = createSessionSecret();
    const tokenHash = hash(sessionToken);
    const idleExpiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
    await withSerializableTransaction(this.prisma, async (db) => {
      const identity = await db.federatedIdentity.findUnique({
        where: { issuer_subject: { issuer: claims.iss!, subject: claims.sub! } },
        include: { account: { include: { emails: { where: { isPrimary: true }, take: 1 } } } },
      });
      let accountId: string;
      if (identity) {
        if (identity.account.status !== 'ACTIVE' || !identity.account.emails[0]?.verifiedAt) {
          throw new BadRequestException({ code: ApiErrorCode.OIDC_TRANSACTION_INVALID });
        }
        accountId = identity.accountId;
        if (claims.email_verified === true && typeof claims.email === 'string' && isEmail(claims.email)) {
          await db.federatedIdentity.update({
            where: { id: identity.id },
            data: { providerEmail: claims.email.trim(), providerEmailVerified: true },
          });
        }
      } else {
        const email = typeof claims.email === 'string' ? claims.email.trim() : '';
        if (!email || email.length > 320 || claims.email_verified !== true || !isEmail(email)) {
          throw new BadRequestException({ code: ApiErrorCode.FEDERATED_EMAIL_UNVERIFIED });
        }
        const normalizedEmail = email.toLowerCase();
        const occupied = await db.accountEmail.findUnique({
          where: { addressNormalized: normalizedEmail },
          select: { id: true },
        });
        if (occupied) throw new ConflictException({ code: ApiErrorCode.CONFLICT });
        const displayName =
          typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : email.split('@')[0]!;
        const account = await db.account.create({
          data: {
            displayName,
            status: 'ACTIVE',
            personalSpace: { create: {} },
            emails: {
              create: {
                addressSubmitted: email,
                addressNormalized: normalizedEmail,
                verifiedAt: now,
                isPrimary: true,
              },
            },
            federatedIdentities: {
              create: {
                issuer: claims.iss!,
                subject: claims.sub!,
                provider,
                providerEmail: email,
                providerEmailVerified: true,
              },
            },
          },
        });
        accountId = account.id;
      }
      await db.authSession.create({
        data: { accountId, tokenHash, lastSeenAt: now, idleExpiresAt, absoluteExpiresAt },
      });
      await db.securityAuditEvent.create({
        data: { accountId, eventType: 'federated_sign_in', outcome: 'succeeded', requestId },
      });
    });
    return sessionToken;
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function encryptSecrets(secrets: OidcTransactionSecrets, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(secrets), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptSecrets(value: string, key: string): OidcTransactionSecrets {
  const [ivText, tagText, ciphertextText] = value.split('.');
  if (!ivText || !tagText || !ciphertextText) throw new Error('Invalid OIDC transaction secret');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return JSON.parse(
    Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString(
      'utf8',
    ),
  ) as OidcTransactionSecrets;
}

function safeReturnPath(value: string | undefined, origin: string): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    throw new BadRequestException({ code: ApiErrorCode.INVALID_REQUEST });
  }
  const parsed = new URL(value, origin);
  if (parsed.origin !== origin) throw new BadRequestException({ code: ApiErrorCode.INVALID_REQUEST });
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function resolveReturnTo(path: string, origin: string): string {
  return new URL(path, origin).href;
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 1)}***@${domain}`;
}
