import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { ResetPasswordCommand } from './reset-password.command.ts';

@Injectable()
export class ResetPasswordHandler {
  constructor(private readonly auth: AuthService) {}

  execute(command: ResetPasswordCommand): Promise<void> {
    return this.auth.resetPassword(command.input, command.requestId);
  }
}
