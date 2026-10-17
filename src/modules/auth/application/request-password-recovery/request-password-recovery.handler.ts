import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { RequestPasswordRecoveryCommand } from './request-password-recovery.command.ts';
@Injectable()
export class RequestPasswordRecoveryHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: RequestPasswordRecoveryCommand) { return this.auth.requestPasswordRecovery(command.email, command.sourceIp, command.requestId); }
}
