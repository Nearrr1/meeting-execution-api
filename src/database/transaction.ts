import { Prisma } from '../generated/prisma/client.ts';
import { TimeUnitMs } from '#common';
import { PrismaService } from './prisma.service.ts';

export async function withSerializableTransaction<T>(
  prisma: PrismaService,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5 * TimeUnitMs.SECOND,
        timeout: 10 * TimeUnitMs.SECOND,
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2034' || attempt === 2) throw error;
    }
  }
  throw new Error('Serializable transaction retry limit reached');
}
