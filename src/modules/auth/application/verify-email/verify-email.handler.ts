import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { VerifyEmailCommand } from './verify-email.command.ts';
@Injectable()
export class VerifyEmailHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: VerifyEmailCommand) {
    return this.auth.verifyEmail(command.input, command.requestId);
  }
}
