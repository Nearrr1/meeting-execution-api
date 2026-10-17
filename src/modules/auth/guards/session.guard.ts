import { ApiErrorCode } from '#common';
import { createHash } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '#database';
import { cookieValue } from '#common';
import { sessionCookieName } from '#common';
import { TimeUnitMs } from '#common';

const IDLE_LIFETIME_MS = 7 * TimeUnitMs.DAY;

export interface AuthenticatedRequest extends Request {
  authSession?: {
    id: string;
    accountId: string;
    displayName: string;
    primaryEmail: string;
    identities: Array<{ id: string; provider: string; label: string; linkedAt?: Date }>;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
  };
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawToken = cookieValue(request, sessionCookieName());
    if (!rawToken) throw new UnauthorizedException({ code: ApiErrorCode.SESSION_INVALID });

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();
    const record = await this.prisma.authSession.findUnique({
      where: { tokenHash },
      include: {
        account: {
          include: {
            emails: { where: { isPrimary: true }, take: 1 },
            federatedIdentities: true,
          },
        },
      },
    });
    if (
      !record ||
      record.revokedAt ||
      record.idleExpiresAt <= now ||
      record.absoluteExpiresAt <= now ||
      record.account.status !== 'ACTIVE' ||
      !record.account.emails[0]?.verifiedAt
    ) {
      throw new UnauthorizedException({ code: ApiErrorCode.SESSION_INVALID });
    }

    const idleExpiresAt = new Date(
      Math.min(now.getTime() + IDLE_LIFETIME_MS, record.absoluteExpiresAt.getTime()),
    );
    const refreshed = await this.prisma.authSession.updateMany({
      where: {
        id: record.id,
        revokedAt: null,
        idleExpiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      data: { lastSeenAt: now, idleExpiresAt },
    });
    if (refreshed.count !== 1) throw new UnauthorizedException({ code: ApiErrorCode.SESSION_INVALID });

    request.authSession = {
      id: record.id,
      accountId: record.accountId,
      displayName: record.account.displayName,
      primaryEmail: record.account.emails[0].addressSubmitted,
      identities: [
        {
          id: `local:${record.accountId}`,
          provider: 'local',
          label: maskEmail(record.account.emails[0].addressSubmitted),
        },
        ...record.account.federatedIdentities.map((identity) => ({
          id: identity.id,
          provider: identity.provider,
          label: maskEmail(identity.providerEmail ?? ''),
          linkedAt: identity.linkedAt,
        })),
      ],
      idleExpiresAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
    };
    return true;
  }
}

@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionGuard) {}

  canActivate(context: ExecutionContext): Promise<boolean> | boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!cookieValue(request, sessionCookieName())) return true;
    return this.sessions.canActivate(context);
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 1)}***@${domain}`;
}
