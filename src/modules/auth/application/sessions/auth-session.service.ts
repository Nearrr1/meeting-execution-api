import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiErrorCode } from '#common';
import type { AuthenticatedRequest } from '../../guards/index.ts';
import { PrismaService } from '#database';

@Injectable()
export class AuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async current(session: NonNullable<AuthenticatedRequest['authSession']>) {
    const account = await this.prisma.account.findUnique({
      where: { id: session.accountId },
      include: { federatedIdentities: { orderBy: { linkedAt: 'asc' } } },
    });
    if (!account) throw new UnauthorizedException({ code: ApiErrorCode.SESSION_INVALID });

    return {
      account: {
        id: account.id,
        displayName: account.displayName,
        primaryEmail: { address: session.primaryEmail, verified: true },
        identities: session.identities.map((identity) => ({
          id: identity.id,
          provider: identity.provider,
          label: identity.label,
          ...(identity.linkedAt ? { linkedAt: identity.linkedAt } : {}),
        })),
      },
      session: { idleExpiresAt: session.idleExpiresAt, absoluteExpiresAt: session.absoluteExpiresAt },
    };
  }

  async list(accountId: string) {
    const now = new Date();
    const sessions = await this.prisma.authSession.findMany({
      where: { accountId, revokedAt: null, idleExpiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        lastSeenAt: true,
        idleExpiresAt: true,
        absoluteExpiresAt: true,
        userAgentLabel: true,
      },
    });
    return {
      sessions: sessions.map(({ userAgentLabel, ...session }) => ({
        ...session,
        ...(userAgentLabel ? { userAgentLabel } : {}),
      })),
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeOwned(accountId: string, sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
