import { Module } from '@nestjs/common';
import { AuthModule } from '#modules';
import { PrismaModule } from '#database';

@Module({ imports: [PrismaModule, AuthModule] })
export class AppModule {}
