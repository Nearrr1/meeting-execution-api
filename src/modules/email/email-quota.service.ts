import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.ts';

export class EmailQuotaBlocked extends Error {}

@Injectable()
export class EmailQuotaService {
  async reserve(transaction: Prisma.TransactionClient, now: Date): Promise<void> {
    const dayKey = `resend:day:${now.toISOString().slice(0, 10)}`;
    const nextDay = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const dayWindow = await transaction.emailQuotaWindow.upsert({
      where: { key: dayKey },
      create: { key: dayKey, count: 1, expiresAt: nextDay },
      update: { count: { increment: 1 } },
    });
    if (dayWindow.count > 100) throw new EmailQuotaBlocked();

    const monthKey = `resend:month:${now.toISOString().slice(0, 7)}`;
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const monthWindow = await transaction.emailQuotaWindow.upsert({
      where: { key: monthKey },
      create: { key: monthKey, count: 1, expiresAt: nextMonth },
      update: { count: { increment: 1 } },
    });
    if (monthWindow.count > 3000) throw new EmailQuotaBlocked();
  }
}
