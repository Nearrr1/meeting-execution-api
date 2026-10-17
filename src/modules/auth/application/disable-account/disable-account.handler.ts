import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { DisableAccountCommand } from './disable-account.command.ts';
@Injectable()
export class DisableAccountHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: DisableAccountCommand) { return this.auth.disableAccount(command.accountId, command.sessionId, command.requestId); }
}
