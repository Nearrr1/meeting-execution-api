import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { VerifyEmailChangeCommand } from './verify-email-change.command.ts';
@Injectable()
export class VerifyEmailChangeHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: VerifyEmailChangeCommand) { return this.auth.verifyEmailChange(command.token, command.requestId); }
}
