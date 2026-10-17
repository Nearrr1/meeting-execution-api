import { ApiErrorCode } from '#common';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { Prisma } from '../../../../generated/prisma/client.ts';
import { PrismaService } from '#database';
import { withSerializableTransaction } from '#database';
import { TimeUnitMs } from '#common';
import { EmailDeliveryService } from '#email';
import { EmailQuotaBlocked, EmailQuotaService } from '#email';
import { getRuntimeConfig } from '#config';

const EMAIL_CHANGE_TTL_MS = 30 * TimeUnitMs.MINUTE;
const SEND_WINDOW_MS = TimeUnitMs.HOUR;

export interface EmailChangeInput {
  newEmail: string;
}

@Injectable()
export class EmailChangeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailDelivery: EmailDeliveryService,
    private readonly emailQuota: EmailQuotaService,
  ) {}

  async request(
    accountId: string,
    sessionId: string,
    input: EmailChangeInput,
    sourceIp: string,
    requestId: string,
  ): Promise<void> {
    const submittedEmail = input.newEmail.trim();
    const normalizedEmail = submittedEmail.toLowerCase();
    const emailDigest = this.identifierDigest(`email-change-email:${normalizedEmail}`);
    const ipDigest = this.identifierDigest(`email-change-ip:${sourceIp || 'unknown'}`);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();
    let requestIdInDb: string | undefined;

    try {
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

        const primaryEmail = await transaction.accountEmail.findFirst({
          where: { accountId, isPrimary: true },
          select: { addressNormalized: true },
        });
        if (primaryEmail?.addressNormalized === normalizedEmail) {
          throw new BadRequestException({ code: ApiErrorCode.EMAIL_UNCHANGED });
        }
        const usedEmail = await transaction.accountEmail.findUnique({
          where: { addressNormalized: normalizedEmail },
          select: { id: true },
        });
        if (usedEmail) throw new ConflictException({ code: ApiErrorCode.EMAIL_UNAVAILABLE });

        await transaction.emailChangeRequest.updateMany({
          where: { pendingEmailNormalized: normalizedEmail, consumedAt: null, expiresAt: { lte: now } },
          data: { consumedAt: now, pendingEmailNormalized: null },
        });
        const windowStart = new Date(now.getTime() - SEND_WINDOW_MS);
        const [emailSends, ipSends] = await Promise.all([
          transaction.rateLimitEvent.count({
            where: {
              scope: 'email_change_email_send',
              identifierDigest: emailDigest,
              createdAt: { gt: windowStart },
            },
          }),
          transaction.rateLimitEvent.count({
            where: {
              scope: 'email_change_source_ip_send',
              identifierDigest: ipDigest,
              createdAt: { gt: windowStart },
            },
          }),
        ]);
        if (emailSends >= 5 || ipSends >= 20) {
          throw new HttpException({ code: ApiErrorCode.RATE_LIMITED }, HttpStatus.TOO_MANY_REQUESTS);
        }
        await transaction.rateLimitEvent.createMany({
          data: [
            { scope: 'email_change_email_send', identifierDigest: emailDigest, createdAt: now },
            { scope: 'email_change_source_ip_send', identifierDigest: ipDigest, createdAt: now },
          ],
        });
        await transaction.emailChangeRequest.updateMany({
          where: { accountId, consumedAt: null },
          data: { consumedAt: now, pendingEmailNormalized: null },
        });
        await this.emailQuota.reserve(transaction, now);
        const changeRequest = await transaction.emailChangeRequest.create({
          data: {
            accountId,
            newEmailSubmitted: submittedEmail,
            newEmailNormalized: normalizedEmail,
            pendingEmailNormalized: normalizedEmail,
            tokenHash,
            expiresAt: new Date(now.getTime() + EMAIL_CHANGE_TTL_MS),
          },
          select: { id: true },
        });
        await this.audit(transaction, accountId, 'email_change', 'requested', requestId);
        requestIdInDb = changeRequest.id;
      });
    } catch (error) {
      if (error instanceof EmailQuotaBlocked) {
        throw new HttpException({ code: ApiErrorCode.EMAIL_QUOTA_EXHAUSTED }, HttpStatus.TOO_MANY_REQUESTS);
      }
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException({ code: ApiErrorCode.EMAIL_UNAVAILABLE });
      }
      throw error;
    }

    if (!requestIdInDb) return;
    try {
      await this.emailDelivery.sendEmailChangeConfirmation(submittedEmail, this.confirmationUrl(token));
    } catch {
      await this.recordDeliveryFailure(accountId, requestId, 'email_change_confirmation_delivery');
      throw new ServiceUnavailableException({ code: ApiErrorCode.EMAIL_DELIVERY_UNAVAILABLE });
    }
  }

  async verify(token: string, requestId: string): Promise<void> {
    if (token.length < 32 || token.length > 128)
      throw new BadRequestException({ code: ApiErrorCode.EMAIL_CHANGE_INVALID });
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const candidate = await this.prisma.emailChangeRequest.findFirst({
      where: { tokenHash, pendingEmailNormalized: { not: null }, consumedAt: null, expiresAt: { gt: now } },
      include: { account: { include: { emails: { where: { isPrimary: true }, take: 1 } } } },
    });
    const currentEmail = candidate?.account.emails[0];
    if (!candidate || !currentEmail || candidate.account.status !== 'ACTIVE') {
      throw new BadRequestException({ code: ApiErrorCode.EMAIL_CHANGE_INVALID });
    }

    await withSerializableTransaction(this.prisma, async (transaction) => {
      const changeRequest = await transaction.emailChangeRequest.findFirst({
        where: {
          id: candidate.id,
          tokenHash,
          pendingEmailNormalized: { not: null },
          consumedAt: null,
          expiresAt: { gt: now },
        },
      });
      if (!changeRequest) throw new BadRequestException({ code: ApiErrorCode.EMAIL_CHANGE_INVALID });
      const collision = await transaction.accountEmail.findUnique({
        where: { addressNormalized: changeRequest.newEmailNormalized },
        select: { id: true },
      });
      if (collision) throw new ConflictException({ code: ApiErrorCode.EMAIL_UNAVAILABLE });
      const consumed = await transaction.emailChangeRequest.updateMany({
        where: { id: changeRequest.id, tokenHash, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now, pendingEmailNormalized: null },
      });
      if (consumed.count !== 1) throw new BadRequestException({ code: ApiErrorCode.EMAIL_CHANGE_INVALID });

      await transaction.accountEmail.delete({ where: { id: currentEmail.id } });
      await transaction.accountEmail.create({
        data: {
          accountId: candidate.accountId,
          addressSubmitted: candidate.newEmailSubmitted,
          addressNormalized: candidate.newEmailNormalized,
          verifiedAt: now,
          isPrimary: true,
        },
      });
      await this.audit(transaction, candidate.accountId, 'email_change', 'succeeded', requestId);
    });

    const notices = await Promise.allSettled([
      this.emailDelivery.sendEmailChangeNotice(currentEmail.addressSubmitted, candidate.newEmailSubmitted),
      this.emailDelivery.sendEmailChangeNotice(candidate.newEmailSubmitted, candidate.newEmailSubmitted),
    ]);
    if (notices.some(({ status }) => status === 'rejected')) {
      await this.recordDeliveryFailure(candidate.accountId, requestId, 'email_change_notice_delivery');
    }
  }

  private identifierDigest(value: string): string {
    const key = getRuntimeConfig().otpHmacKey;
    return createHmac('sha256', key).update(value).digest('hex');
  }

  private confirmationUrl(token: string): string {
    const url = new URL(getRuntimeConfig().emailChangeUrl);
    url.searchParams.set('token', token);
    return url.toString();
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
    eventType: string,
  ): Promise<void> {
    try {
      await this.prisma.securityAuditEvent.create({
        data: { accountId, eventType, outcome: 'failed', requestId, metadata: {} },
      });
    } catch {
      // Keep audit storage failures out of public responses and logs.
    }
  }
}
