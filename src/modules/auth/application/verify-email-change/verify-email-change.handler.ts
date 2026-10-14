import { Injectable } from '@nestjs/common';
import { EmailChangeService } from '../email-change/index.ts';
import { VerifyEmailChangeCommand } from './verify-email-change.command.ts';

@Injectable()
export class VerifyEmailChangeHandler {
  constructor(private readonly emailChange: EmailChangeService) {}
  execute(command: VerifyEmailChangeCommand): Promise<void> {
    return this.emailChange.verify(command.token, command.requestId);
  }
}
