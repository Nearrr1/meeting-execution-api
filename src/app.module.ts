import { Module } from '@nestjs/common';
import { AuthModule, HealthModule } from '#modules';
import { PrismaModule } from '#database';

@Module({ imports: [PrismaModule, AuthModule, HealthModule] })
export class AppModule {}
