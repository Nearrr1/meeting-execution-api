import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { ChangePasswordCommand } from './change-password.command.ts';
@Injectable()
export class ChangePasswordHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: ChangePasswordCommand) { return this.auth.changePassword(command.accountId, command.sessionId, command.input, command.requestId); }
}
