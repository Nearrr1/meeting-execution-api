import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '#database';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  liveness() {
    return { status: 'alive' };
  }

  @Get('ready')
  async readiness(): Promise<{ status: 'ready' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException({ code: 'service_not_ready' });
    }
  }
}
