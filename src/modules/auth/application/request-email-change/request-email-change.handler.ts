import { Injectable } from '@nestjs/common';
import { EmailChangeService } from '../email-change/index.ts';
import { RequestEmailChangeCommand } from './request-email-change.command.ts';

@Injectable()
export class RequestEmailChangeHandler {
  constructor(private readonly emailChange: EmailChangeService) {}
  execute(command: RequestEmailChangeCommand): Promise<void> {
    return this.emailChange.request(command.accountId, command.sessionId, command.input, command.sourceIp, command.requestId);
  }
}
