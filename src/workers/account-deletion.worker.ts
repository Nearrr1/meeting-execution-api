import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '#database';
import { TimeUnitMs } from '#common';
import type { Prisma } from '../generated/prisma/client.ts';

@Injectable()
export class AccountDeletionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountDeletionWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    void this.run();
    this.timer = setInterval(() => void this.run(), TimeUnitMs.MINUTE);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        const due = await tx.$queryRaw<Array<{ account_id: string }>>`
          SELECT account_id FROM account_deletion_requests
          WHERE status = 'scheduled' AND purge_at <= CURRENT_TIMESTAMP
          ORDER BY purge_at LIMIT 20 FOR UPDATE SKIP LOCKED
        `;
        for (const { account_id: accountId } of due) {
          await this.purgeAccount(tx, accountId);
        }
      }, { maxWait: 5 * TimeUnitMs.SECOND, timeout: 30 * TimeUnitMs.SECOND });
    } catch {
      this.logger.error('Account deletion worker failed');
    } finally {
      this.running = false;
    }
  }

  private async purgeAccount(
    tx: Prisma.TransactionClient,
    accountId: string,
  ): Promise<void> {
    const completedAt = new Date();
    await Promise.all([
      tx.accountEmail.deleteMany({ where: { accountId } }),
      tx.localCredential.deleteMany({ where: { accountId } }),
      tx.federatedIdentity.deleteMany({ where: { accountId } }),
      tx.authSession.deleteMany({ where: { accountId } }),
      tx.authChallenge.deleteMany({ where: { accountId } }),
      tx.emailChangeRequest.deleteMany({ where: { accountId } }),
      tx.personalSpace.deleteMany({ where: { accountId } }),
      tx.securityAuditEvent.deleteMany({ where: { accountId } }),
    ]);
    await Promise.all([
      tx.account.update({
        where: { id: accountId },
        data: { displayName: '', status: 'DELETED', deletedAt: completedAt },
      }),
      tx.accountDeletionRequest.update({
        where: { accountId },
        data: { status: 'COMPLETED', completedAt },
      }),
    ]);
  }
}
