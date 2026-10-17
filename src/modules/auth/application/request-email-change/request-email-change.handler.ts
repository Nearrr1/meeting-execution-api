import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { RequestEmailChangeCommand } from './request-email-change.command.ts';
@Injectable()
export class RequestEmailChangeHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: RequestEmailChangeCommand) { return this.auth.requestEmailChange(command.accountId, command.sessionId, command.input, command.sourceIp, command.requestId); }
}
