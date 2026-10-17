import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiErrorCode } from '#common';
import type { Prisma } from '../../../../generated/prisma/client.ts';
import { PrismaService } from '#database';
import { TimeUnitMs } from '#common';
import { withSerializableTransaction } from '#database';

@Injectable()
export class AccountLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async disableAccount(accountId: string, sessionId: string, requestId: string): Promise<void> {
    const now = new Date();
    await withSerializableTransaction(this.prisma, async (transaction) => {
      const session = await this.findRecentlyReauthenticatedSession(transaction, accountId, sessionId, now);
      if (!session) throw new UnauthorizedException({ code: ApiErrorCode.REAUTHENTICATION_REQUIRED });

      const account = await transaction.account.updateMany({
        where: { id: accountId, status: 'ACTIVE' },
        data: { status: 'DISABLED' },
      });
      if (account.count !== 1) throw new UnauthorizedException({ code: ApiErrorCode.SESSION_INVALID });

      await transaction.authSession.updateMany({
        where: { accountId, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit(transaction, accountId, 'account_disable', requestId);
    });
  }

  async requestDeletion(
    accountId: string,
    sessionId: string,
    requestId: string,
  ): Promise<{ status: 'deletion_pending'; purgeAt: string }> {
    const now = new Date();
    const purgeAt = new Date(now.getTime() + 30 * TimeUnitMs.DAY);
    await withSerializableTransaction(this.prisma, async (transaction) => {
      const session = await this.findRecentlyReauthenticatedSession(transaction, accountId, sessionId, now);
      if (!session) throw new UnauthorizedException({ code: ApiErrorCode.REAUTHENTICATION_REQUIRED });

      const account = await transaction.account.updateMany({
        where: { id: accountId, status: 'ACTIVE' },
        data: { status: 'DELETION_PENDING', deletionRequestedAt: now, purgeAt },
      });
      if (account.count !== 1) throw new UnauthorizedException({ code: ApiErrorCode.SESSION_INVALID });

      await transaction.accountDeletionRequest.create({ data: { accountId, requestedAt: now, purgeAt } });
      await transaction.authSession.updateMany({
        where: { accountId, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit(transaction, accountId, 'account_deletion_request', requestId);
    });
    return { status: 'deletion_pending', purgeAt: purgeAt.toISOString() };
  }

  private findRecentlyReauthenticatedSession(
    transaction: Prisma.TransactionClient,
    accountId: string,
    sessionId: string,
    now: Date,
  ) {
    return transaction.authSession.findFirst({
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
  }

  private async audit(
    transaction: Prisma.TransactionClient,
    accountId: string,
    eventType: string,
    requestId: string,
  ): Promise<void> {
    await transaction.securityAuditEvent.create({
      data: { accountId, eventType, outcome: 'succeeded', requestId, metadata: {} },
    });
  }
}
