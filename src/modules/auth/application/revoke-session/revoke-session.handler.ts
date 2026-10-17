import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { RevokeSessionCommand } from './revoke-session.command.ts';
@Injectable()
export class RevokeSessionHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: RevokeSessionCommand) {
    return this.auth.revokeSession(command.accountId, command.sessionId);
  }
}
