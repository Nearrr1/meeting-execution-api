import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ApiErrorCode } from '#common';
import { PrismaService, withSerializableTransaction } from '#database';

const SUPPORT_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

@Injectable()
export class ReactivateAccountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called only by a trusted support workflow after it has independently verified account ownership.
   * This service is deliberately not exposed through a public HTTP endpoint.
   */
  async reactivateAfterOwnershipVerification(input: {
    accountId: string;
    supportActorId: string;
    verificationReference: string;
    requestId: string;
  }): Promise<void> {
    if (
      !SUPPORT_REFERENCE_PATTERN.test(input.supportActorId) ||
      !SUPPORT_REFERENCE_PATTERN.test(input.verificationReference)
    ) {
      throw new BadRequestException({ code: ApiErrorCode.INVALID_REQUEST });
    }

    const reactivated = await withSerializableTransaction(this.prisma, async (transaction) => {
      const account = await transaction.account.findUnique({
        where: { id: input.accountId },
        select: { id: true, status: true },
      });
      if (!account) return false;

      if (account.status !== 'DISABLED') {
        await transaction.securityAuditEvent.create({
          data: {
            accountId: account.id,
            actor: `support:${input.supportActorId}`,
            eventType: 'account_reactivation',
            outcome: 'rejected',
            requestId: input.requestId,
            metadata: { verificationReference: input.verificationReference },
          },
        });
        return false;
      }

      const update = await transaction.account.updateMany({
        where: { id: account.id, status: 'DISABLED' },
        data: { status: 'ACTIVE' },
      });
      if (update.count !== 1) return false;

      await transaction.authSession.updateMany({
        where: { accountId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.securityAuditEvent.create({
        data: {
          accountId: account.id,
          actor: `support:${input.supportActorId}`,
          eventType: 'account_reactivation',
          outcome: 'succeeded',
          requestId: input.requestId,
          metadata: { verificationReference: input.verificationReference },
        },
      });
      return true;
    });

    if (!reactivated) throw new ConflictException({ code: ApiErrorCode.CONFLICT });
  }
}
