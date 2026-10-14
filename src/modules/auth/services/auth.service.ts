import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException
} from '@nestjs/common';
import type { ScryptOptions } from 'node:crypto';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { ApiErrorCode } from '#common';
import { createSessionSecret } from '#common';
import { TimeUnitMs } from '#common';
import { PrismaService } from '#database';
import { withSerializableTransaction } from '#database';
import { ChallengePurpose, Prisma } from '../../../generated/prisma/client.ts';
import { EmailDeliveryService } from '#email';
import { EmailQuotaBlocked, EmailQuotaService } from '#email';
import { ChangePasswordInput, PasswordResetInput, RegistrationInput, RegistrationResult, SignInResult, VerifyEmailInput, VerifyEmailResult } from '../auth.types.ts';

const OTP_TTL_MS = 10 * TimeUnitMs.MINUTE;
const PASSWORD_RESET_TTL_MS = 30 * TimeUnitMs.MINUTE;
const RESEND_COOLDOWN_MS = TimeUnitMs.MINUTE;
const SEND_WINDOW_MS = TimeUnitMs.HOUR;
const SIGN_IN_WINDOW_MS = TimeUnitMs.HOUR;
const SIGN_IN_EMAIL_LIMIT = 5;
const SIGN_IN_IP_LIMIT = 20;
const SESSION_IDLE_MS = 7 * TimeUnitMs.DAY;
const SESSION_ABSOLUTE_MS = 30 * TimeUnitMs.DAY;
const MAX_PASSWORD_CODEPOINTS = 64 * 1024;



@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailDelivery: EmailDeliveryService,
    private readonly emailQuota: EmailQuotaService,
  ) {}

  async register(input: RegistrationInput, sourceIp: string, requestId: string): Promise<RegistrationResult> {
    this.validatePassword(input.password);
    if (input.password !== input.passwordConfirmation) {
      throw new BadRequestException({ code: ApiErrorCode.PASSWORD_CONFIRMATION_MISMATCH });
    }

    const submittedEmail = input.email.trim();
    const normalizedEmail = submittedEmail.toLowerCase();
    const passwordHash = await hashPassword(input.password);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const verifierDigest = this.otpDigest(normalizedEmail, code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_MS);
    const emailDigest = this.identifierDigest(`email:${normalizedEmail}`);
    const ipDigest = this.identifierDigest(`ip:${sourceIp || 'unknown'}`);

    let accountId: string | undefined;
    try {
      await withSerializableTransaction(this.prisma, async (transaction) => {
        const existing = await transaction.accountEmail.findUnique({
          where: { addressNormalized: normalizedEmail },
          select: { id: true },
        });
        if (existing) return;

        const canSend = await this.reserveOtpQuota(transaction, emailDigest, ipDigest, now, false);
        if (!canSend) return;

        const account = await transaction.account.create({
          data: {
            displayName: input.displayName?.trim() || submittedEmail.split('@')[0] || submittedEmail,
            personalSpace: { create: {} },
            emails: {
              create: {
                addressSubmitted: submittedEmail,
                addressNormalized: normalizedEmail,
                isPrimary: true,
              },
            },
            localCredential: { create: { passwordHash } },
          },
          include: { emails: { select: { id: true }, take: 1 } },
        });
        const email = account.emails[0];
        if (!email) throw new Error('Registration email relation was not created');

        await transaction.authChallenge.create({
          data: {
            accountId: account.id,
            emailId: email.id,
            purpose: ChallengePurpose.EMAIL_VERIFICATION,
            verifierDigest,
            expiresAt,
          },
        });
        accountId = account.id;
        await this.audit(transaction, account.id, 'registration_started', 'accepted', requestId);
      });
    } catch (error) {
      if (error instanceof EmailQuotaBlocked || this.isUniqueConflict(error)) {
        return { status: 'verification_required', expiresAt: expiresAt.toISOString(), resendAvailableAt: resendAvailableAt.toISOString() };
      }
      throw error;
    }

    if (accountId) {
      try {
        await this.emailDelivery.sendVerificationCode(submittedEmail, code);
      } catch {
        await this.recordDeliveryFailure(accountId, requestId);
      }
    }
    return { status: 'verification_required', expiresAt: expiresAt.toISOString(), resendAvailableAt: resendAvailableAt.toISOString() };
  }

  async resendOtp(emailInput: string, sourceIp: string, requestId: string): Promise<void> {
    const submittedEmail = emailInput.trim();
    const normalizedEmail = submittedEmail.toLowerCase();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const verifierDigest = this.otpDigest(normalizedEmail, code);
    const now = new Date();
    const emailDigest = this.identifierDigest(`email:${normalizedEmail}`);
    const ipDigest = this.identifierDigest(`ip:${sourceIp || 'unknown'}`);
    let delivery: { accountId: string; address: string } | undefined;

    try {
      await withSerializableTransaction(this.prisma, async (transaction) => {
        const email = await transaction.accountEmail.findUnique({
          where: { addressNormalized: normalizedEmail },
          include: { account: { select: { id: true, status: true } } },
        });
        if (!email || email.verifiedAt || email.account.status !== 'PENDING_EMAIL') return;

        const canSend = await this.reserveOtpQuota(transaction, emailDigest, ipDigest, now, true);
        if (!canSend) return;

        await transaction.authChallenge.updateMany({
          where: {
            emailId: email.id,
            purpose: ChallengePurpose.EMAIL_VERIFICATION,
            consumedAt: null,
          },
          data: { consumedAt: now },
        });
        await transaction.authChallenge.create({
          data: {
            accountId: email.account.id,
            emailId: email.id,
            purpose: ChallengePurpose.EMAIL_VERIFICATION,
            verifierDigest,
            expiresAt: new Date(now.getTime() + OTP_TTL_MS),
          },
        });
        delivery = { accountId: email.account.id, address: email.addressSubmitted };
      });
    } catch (error) {
      if (!(error instanceof EmailQuotaBlocked) && !this.isUniqueConflict(error)) throw error;
    }

    if (delivery) {
      try {
        await this.emailDelivery.sendVerificationCode(delivery.address, code);
      } catch {
        await this.recordDeliveryFailure(delivery.accountId, requestId);
      }
    }
  }

  async verifyEmail(input: VerifyEmailInput, requestId: string): Promise<VerifyEmailResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const candidateDigest = this.otpDigest(normalizedEmail, input.code);
    const now = new Date();
    const sessionToken = createSessionSecret();
    const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
    let result: VerifyEmailResult | undefined;

    await withSerializableTransaction(this.prisma, async (transaction) => {
      const email = await transaction.accountEmail.findUnique({
        where: { addressNormalized: normalizedEmail },
        include: { account: true },
      });
      const challenge = email
        ? await transaction.authChallenge.findFirst({
            where: {
              emailId: email.id,
              purpose: ChallengePurpose.EMAIL_VERIFICATION,
              consumedAt: null,
            },
            orderBy: { createdAt: 'desc' },
          })
        : null;

      if (
        !email || email.verifiedAt || email.account.status !== 'PENDING_EMAIL' || !challenge ||
        challenge.expiresAt <= now || challenge.failedAttempts >= 5
      ) {
        if (challenge && challenge.expiresAt > now && challenge.failedAttempts < 5) {
          await transaction.authChallenge.updateMany({
            where: { id: challenge.id, consumedAt: null, failedAttempts: { lt: 5 } },
            data: { failedAttempts: { increment: 1 } },
          });
          await this.audit(transaction, challenge.accountId, 'email_verification', 'failed', requestId);
        }
        return;
      }

      const consumed = await transaction.authChallenge.updateMany({
        where: {
          id: challenge.id,
          verifierDigest: candidateDigest,
          consumedAt: null,
          expiresAt: { gt: now },
          failedAttempts: { lt: 5 },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        if (challenge.verifierDigest !== candidateDigest) {
          await transaction.authChallenge.updateMany({
            where: { id: challenge.id, consumedAt: null, failedAttempts: { lt: 5 } },
            data: { failedAttempts: { increment: 1 } },
          });
          await this.audit(transaction, challenge.accountId, 'email_verification', 'failed', requestId);
        }
        return;
      }

      await transaction.accountEmail.update({ where: { id: email.id }, data: { verifiedAt: now } });
      await transaction.account.update({ where: { id: email.accountId }, data: { status: 'ACTIVE' } });
      const idleExpiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
      const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
      await transaction.authSession.create({
        data: { accountId: email.accountId, tokenHash, lastSeenAt: now, idleExpiresAt, absoluteExpiresAt },
      });
      await this.audit(transaction, email.accountId, 'email_verification', 'succeeded', requestId);
      result = {
        sessionToken,
        accountSession: {
          account: {
            id: email.accountId,
            displayName: email.account.displayName,
            primaryEmail: { address: email.addressSubmitted, verified: true },
            identities: [{
              id: `local:${email.accountId}`,
              provider: 'local',
              label: maskEmail(email.addressSubmitted),
            }],
          },
          session: { idleExpiresAt, absoluteExpiresAt },
        },
      };
    });

    if (!result) throw new BadRequestException({ code: ApiErrorCode.VERIFICATION_FAILED });
    return result;
  }

  async signIn(emailInput: string, password: string, sourceIp: string, requestId: string): Promise<SignInResult> {
    const normalizedEmail = emailInput.trim().toLowerCase();
    const emailDigest = this.identifierDigest(`signin-email:${normalizedEmail}`);
    const ipDigest = this.identifierDigest(`signin-ip:${sourceIp || 'unknown'}`);
    const now = new Date();
    if (!(await this.signInAllowed(emailDigest, ipDigest, now))) {
      throw new UnauthorizedException({ code: ApiErrorCode.CREDENTIALS_INVALID });
    }
    const email = await this.prisma.accountEmail.findUnique({
      where: { addressNormalized: normalizedEmail },
      include: {
        account: {
          include: {
            localCredential: true,
            federatedIdentities: { orderBy: { linkedAt: 'asc' } },
          },
        },
      },
    });
    const storedHash = email?.account.localCredential?.passwordHash;
    const passwordMatches = await verifyPassword(password, storedHash ?? DUMMY_PASSWORD_HASH);
    if (!email || !storedHash || !passwordMatches || !email.verifiedAt || email.account.status !== 'ACTIVE') {
      await this.recordFailedSignIn(emailDigest, ipDigest, now, email?.account.id, requestId);
      throw new UnauthorizedException({ code: ApiErrorCode.CREDENTIALS_INVALID });
    }

    const sessionToken = createSessionSecret();
    const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
    const idleExpiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
    const account = email.account;
    await withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.account.findUnique({
        where: { id: account.id },
        select: { status: true },
      });
      if (current?.status !== 'ACTIVE') {
        throw new UnauthorizedException({ code: ApiErrorCode.CREDENTIALS_INVALID });
      }
      await transaction.authSession.create({
        data: { accountId: account.id, tokenHash, lastSeenAt: now, idleExpiresAt, absoluteExpiresAt },
      });
      await this.audit(transaction, account.id, 'local_sign_in', 'succeeded', requestId);
    });

    return {
      sessionToken,
      accountSession: {
        account: {
          id: account.id,
          displayName: account.displayName,
          primaryEmail: { address: email.addressSubmitted, verified: true },
          identities: [
            { id: `local:${account.id}`, provider: 'local', label: maskEmail(email.addressSubmitted) },
            ...account.federatedIdentities.map((identity) => ({
              id: identity.id,
              provider: identity.provider,
              label: maskEmail(identity.providerEmail ?? ''),
              linkedAt: identity.linkedAt,
            })),
          ],
        },
        session: { idleExpiresAt, absoluteExpiresAt },
      },
    };
  }

  async requestPasswordRecovery(emailInput: string, sourceIp: string, requestId: string): Promise<void> {
    const submittedEmail = emailInput.trim();
    const normalizedEmail = submittedEmail.toLowerCase();
    const emailDigest = this.identifierDigest(`recovery-email:${normalizedEmail}`);
    const ipDigest = this.identifierDigest(`recovery-ip:${sourceIp || 'unknown'}`);
    const token = randomBytes(32).toString('base64url');
    const tokenDigest = createHash('sha256').update(token).digest('hex');
    const now = new Date();
    let delivery: { accountId: string; address: string } | undefined;

    try {
      await withSerializableTransaction(this.prisma, async (transaction) => {
        const windowStart = new Date(now.getTime() - SEND_WINDOW_MS);
        const [emailSends, ipSends] = await Promise.all([
          transaction.rateLimitEvent.count({
            where: { scope: 'recovery_email_send', identifierDigest: emailDigest, createdAt: { gt: windowStart } },
          }),
          transaction.rateLimitEvent.count({
            where: { scope: 'recovery_source_ip_send', identifierDigest: ipDigest, createdAt: { gt: windowStart } },
          }),
        ]);
        if (emailSends >= 5 || ipSends >= 20) return;

        await transaction.rateLimitEvent.createMany({
          data: [
            { scope: 'recovery_email_send', identifierDigest: emailDigest, createdAt: now },
            { scope: 'recovery_source_ip_send', identifierDigest: ipDigest, createdAt: now },
          ],
        });

        const email = await transaction.accountEmail.findUnique({
          where: { addressNormalized: normalizedEmail },
          include: { account: { include: { localCredential: true } } },
        });
        if (!email?.verifiedAt || email?.account?.status !== 'ACTIVE' || !email?.account?.localCredential) return;

        await this.emailQuota.reserve(transaction, now);
        await transaction.authChallenge.updateMany({
          where: {
            emailId: email.id,
            purpose: ChallengePurpose.PASSWORD_RECOVERY,
            consumedAt: null,
          },
          data: { consumedAt: now },
        });
        await transaction.authChallenge.create({
          data: {
            accountId: email.accountId,
            emailId: email.id,
            purpose: ChallengePurpose.PASSWORD_RECOVERY,
            verifierDigest: tokenDigest,
            expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
          },
        });
        delivery = { accountId: email.accountId, address: email.addressSubmitted };
      });
    } catch (error) {
      if (!(error instanceof EmailQuotaBlocked) && !this.isUniqueConflict(error)) throw error;
    }

    if (!delivery) return;
    try {
      const resetUrl = this.passwordResetUrl(token);
      await this.emailDelivery.sendPasswordReset(delivery.address, resetUrl);
      await this.prisma.securityAuditEvent.create({
        data: { accountId: delivery.accountId, eventType: 'password_recovery', outcome: 'requested', requestId, metadata: {} },
      });
    } catch {
      await this.recordDeliveryFailure(delivery.accountId, requestId, 'password_recovery_email_delivery');
    }
  }

  async resetPassword(input: PasswordResetInput, requestId: string): Promise<void> {
    this.validatePassword(input.newPassword);
    if (input.newPassword !== input.passwordConfirmation) {
      throw new BadRequestException({ code: ApiErrorCode.PASSWORD_CONFIRMATION_MISMATCH });
    }
    if (input.token.length < 32 || input.token.length > 128) {
      throw new BadRequestException({ code: ApiErrorCode.PASSWORD_RESET_INVALID });
    }

    const tokenDigest = createHash('sha256').update(input.token).digest('hex');
    const now = new Date();
    const candidate = await this.prisma.authChallenge.findFirst({
      where: {
        purpose: ChallengePurpose.PASSWORD_RECOVERY,
        verifierDigest: tokenDigest,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      include: { account: { include: { localCredential: true } } },
    });
    if (candidate?.account.status !== 'ACTIVE' || !candidate?.account.localCredential) {
      throw new BadRequestException({ code: ApiErrorCode.PASSWORD_RESET_INVALID });
    }
    const passwordHash = await hashPassword(input.newPassword);
    await withSerializableTransaction(this.prisma, async (transaction) => {
      const challenge = await transaction.authChallenge.findFirst({
        where: {
          purpose: ChallengePurpose.PASSWORD_RECOVERY,
          verifierDigest: tokenDigest,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        include: { account: { include: { localCredential: true } } },
      });
      if (challenge?.account.status !== 'ACTIVE' || !challenge?.account.localCredential) {
        throw new BadRequestException({ code: ApiErrorCode.PASSWORD_RESET_INVALID });
      }
      const consumed = await transaction.authChallenge.updateMany({
        where: {
          id: challenge.id,
          purpose: ChallengePurpose.PASSWORD_RECOVERY,
          verifierDigest: tokenDigest,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new BadRequestException({ code: ApiErrorCode.PASSWORD_RESET_INVALID });

      await transaction.localCredential.update({
        where: { accountId: challenge.accountId },
        data: { passwordHash, changedAt: now },
      });
      await transaction.authSession.updateMany({
        where: { accountId: challenge.accountId, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit(transaction, challenge.accountId, 'password_recovery', 'succeeded', requestId);
    });
  }

  async reauthenticateLocal(accountId: string, sessionId: string, password: string, requestId: string): Promise<void> {
    const credential = await this.prisma.localCredential.findUnique({ where: { accountId } });
    const passwordMatches = await verifyPassword(password, credential?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!credential || !passwordMatches) throw new UnauthorizedException({ code: ApiErrorCode.CREDENTIALS_INVALID });

    const now = new Date();
    await withSerializableTransaction(this.prisma, async (transaction) => {
      const updated = await transaction.authSession.updateMany({
        where: {
          id: sessionId,
          accountId,
          revokedAt: null,
          idleExpiresAt: { gt: now },
          absoluteExpiresAt: { gt: now },
        },
        data: { reauthenticatedAt: now },
      });
      if (updated.count !== 1) throw new UnauthorizedException({ code: ApiErrorCode.SESSION_INVALID });
      await this.audit(transaction, accountId, 'reauthentication', 'succeeded', requestId);
    });
  }

  async changePassword(
    accountId: string,
    sessionId: string,
    input: ChangePasswordInput,
    requestId: string,
  ): Promise<void> {
    this.validatePassword(input.newPassword);
    if (input.newPassword !== input.passwordConfirmation) {
      throw new BadRequestException({ code: ApiErrorCode.PASSWORD_CONFIRMATION_MISMATCH });
    }
    const credential = await this.prisma.localCredential.findUnique({ where: { accountId } });
    const passwordMatches = await verifyPassword(input.currentPassword, credential?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!credential || !passwordMatches) throw new UnauthorizedException({ code: ApiErrorCode.CREDENTIALS_INVALID });

    const passwordHash = await hashPassword(input.newPassword);
    const now = new Date();
    await withSerializableTransaction(this.prisma, async (transaction) => {
      const session = await transaction.authSession.findFirst({
        where: {
          id: sessionId,
          accountId,
          revokedAt: null,
          idleExpiresAt: { gt: now },
          absoluteExpiresAt: { gt: now },
          reauthenticatedAt: { gte: new Date(now.getTime() - 10 * TimeUnitMs.MINUTE) },
        },
        select: { id: true },
      });
      if (!session) throw new UnauthorizedException({ code: ApiErrorCode.REAUTHENTICATION_REQUIRED });

      const changed = await transaction.localCredential.updateMany({
        where: { accountId, passwordHash: credential.passwordHash },
        data: { passwordHash, changedAt: now },
      });
      if (changed.count !== 1) throw new UnauthorizedException({ code: ApiErrorCode.CREDENTIALS_INVALID });
      await transaction.authSession.updateMany({
        where: { accountId, id: { not: sessionId }, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit(transaction, accountId, 'password_change', 'succeeded', requestId);
    });
  }

  private async reserveOtpQuota(
    transaction: Prisma.TransactionClient,
    emailDigest: string,
    ipDigest: string,
    now: Date,
    enforceCooldown: boolean,
  ): Promise<boolean> {
    const windowStart = new Date(now.getTime() - SEND_WINDOW_MS);
    const emailEvents = await transaction.rateLimitEvent.count({
      where: { scope: 'otp_email_send', identifierDigest: emailDigest, createdAt: { gt: windowStart } },
    });
    const ipEvents = await transaction.rateLimitEvent.count({
      where: { scope: 'otp_source_ip_send', identifierDigest: ipDigest, createdAt: { gt: windowStart } },
    });
    if (emailEvents >= 5 || ipEvents >= 20) return false;

    if (enforceCooldown) {
      const recent = await transaction.rateLimitEvent.findFirst({
        where: {
          scope: 'otp_email_send',
          identifierDigest: emailDigest,
          createdAt: { gt: new Date(now.getTime() - RESEND_COOLDOWN_MS) },
        },
        select: { id: true },
      });
      if (recent) return false;
    }

    await this.emailQuota.reserve(transaction, now);

    await transaction.rateLimitEvent.createMany({
      data: [
        { scope: 'otp_email_send', identifierDigest: emailDigest, createdAt: now },
        { scope: 'otp_source_ip_send', identifierDigest: ipDigest, createdAt: now },
      ],
    });
    return true;
  }

  private passwordResetUrl(token: string): string {
    const configuredUrl = process.env.PASSWORD_RESET_URL;
    if (!configuredUrl) throw new InternalServerErrorException({ code: ApiErrorCode.PASSWORD_RECOVERY_NOT_CONFIGURED });
    const url = new URL(configuredUrl);
    const allowedOrigins = (process.env.WEB_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    if (
      !allowedOrigins.includes(url.origin) || url.username || url.password || url.hash ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    ) {
      throw new InternalServerErrorException({ code: ApiErrorCode.PASSWORD_RECOVERY_NOT_CONFIGURED });
    }
    url.searchParams.set('token', token);
    return url.toString();
  }

  private async signInAllowed(emailDigest: string, ipDigest: string, now: Date): Promise<boolean> {
    const windowStart = new Date(now.getTime() - SIGN_IN_WINDOW_MS);
    const [emailFailures, ipFailures] = await Promise.all([
      this.prisma.rateLimitEvent.count({
        where: { scope: 'signin_email_failure', identifierDigest: emailDigest, createdAt: { gt: windowStart } },
      }),
      this.prisma.rateLimitEvent.count({
        where: { scope: 'signin_ip_failure', identifierDigest: ipDigest, createdAt: { gt: windowStart } },
      }),
    ]);
    return emailFailures < SIGN_IN_EMAIL_LIMIT && ipFailures < SIGN_IN_IP_LIMIT;
  }

  private async recordFailedSignIn(
    emailDigest: string,
    ipDigest: string,
    now: Date,
    accountId: string | undefined,
    requestId: string,
  ): Promise<void> {
    await withSerializableTransaction(this.prisma, async (transaction) => {
      const windowStart = new Date(now.getTime() - SIGN_IN_WINDOW_MS);
      const [emailFailures, ipFailures] = await Promise.all([
        transaction.rateLimitEvent.count({
          where: { scope: 'signin_email_failure', identifierDigest: emailDigest, createdAt: { gt: windowStart } },
        }),
        transaction.rateLimitEvent.count({
          where: { scope: 'signin_ip_failure', identifierDigest: ipDigest, createdAt: { gt: windowStart } },
        }),
      ]);
      if (emailFailures >= SIGN_IN_EMAIL_LIMIT || ipFailures >= SIGN_IN_IP_LIMIT) return;

      await transaction.rateLimitEvent.createMany({
        data: [
          { scope: 'signin_email_failure', identifierDigest: emailDigest, createdAt: now },
          { scope: 'signin_ip_failure', identifierDigest: ipDigest, createdAt: now },
        ],
      });
      if (accountId) await this.audit(transaction, accountId, 'local_sign_in', 'failed', requestId);
    });
  }

  private otpDigest(email: string, code: string): string {
    const key = process.env.OTP_HMAC_KEY;
    if (!key || Buffer.byteLength(key) < 32) {
      throw new InternalServerErrorException({ code: ApiErrorCode.AUTHENTICATION_NOT_CONFIGURED });
    }
    return createHmac('sha256', key).update(`${email}\0${code}`).digest('hex');
  }

  private identifierDigest(value: string): string {
    const key = process.env.OTP_HMAC_KEY;
    if (!key || Buffer.byteLength(key) < 32) {
      throw new InternalServerErrorException({ code: ApiErrorCode.AUTHENTICATION_NOT_CONFIGURED });
    }
    return createHmac('sha256', key).update(value).digest('hex');
  }

  private validatePassword(password: string): void {
    const characters = Array.from(password);
    const valid = characters.length >= 8 && characters.length <= MAX_PASSWORD_CODEPOINTS &&
      /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password) && /\p{N}/u.test(password) &&
      /[^\p{L}\p{N}]/u.test(password);
    if (!valid) throw new BadRequestException({ code: ApiErrorCode.PASSWORD_POLICY_FAILED });
  }

  private async audit(
    transaction: Prisma.TransactionClient,
    accountId: string,
    eventType: string,
    outcome: string,
    requestId: string,
  ): Promise<void> {
    await transaction.securityAuditEvent.create({
      data: { accountId, eventType, outcome, requestId, metadata: {} },
    });
  }

  private async recordDeliveryFailure(
    accountId: string,
    requestId: string,
    eventType = 'verification_email_delivery',
  ): Promise<void> {
    try {
      await this.prisma.securityAuditEvent.create({
        data: {
          accountId,
          eventType,
          outcome: 'failed',
          requestId,
          metadata: {},
        },
      });
    } catch {
      // Delivery and audit errors stay out of the public response and logs.
    }
  }

  private isUniqueConflict(error: unknown): boolean {
    return (error as { code?: string }).code === 'P2002';
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveScrypt(password, salt);
  return `scrypt$32768$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

const DUMMY_PASSWORD_HASH = `scrypt$32768$8$1$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`;

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, saltText, keyText] = encoded.split('$');
  if (algorithm !== 'scrypt' || cost !== '32768' || blockSize !== '8' || parallelization !== '1' || !saltText || !keyText) {
    return false;
  }
  const expected = Buffer.from(keyText, 'base64url');
  const actual = await deriveScrypt(password, Buffer.from(saltText, 'base64url'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function deriveScrypt(password: string, salt: Buffer): Promise<Buffer> {
  const options: ScryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived as Buffer);
    });
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 1)}***@${domain}`;
}
