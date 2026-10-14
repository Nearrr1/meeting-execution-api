import { Injectable } from '@nestjs/common';
import { EmailChangeService } from '../email-change/index.ts';
import type { EmailChangeInput } from '../email-change/index.ts';

@Injectable()
export class RequestEmailChangeService {
  constructor(private readonly emailChange: EmailChangeService) {}
  execute(accountId: string, sessionId: string, input: EmailChangeInput, sourceIp: string, requestId: string) {
    return this.emailChange.request(accountId, sessionId, input, sourceIp, requestId);
  }
}
