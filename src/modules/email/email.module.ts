import { Module } from '@nestjs/common';
import { EmailDeliveryService } from './email-delivery.service.ts';
import { EmailQuotaService } from './email-quota.service.ts';

@Module({
  providers: [EmailDeliveryService, EmailQuotaService],
  exports: [EmailDeliveryService, EmailQuotaService],
})
export class EmailModule {}
