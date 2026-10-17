import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { RevokeCurrentSessionCommand } from './revoke-current-session.command.ts';
@Injectable()
export class RevokeCurrentSessionHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: RevokeCurrentSessionCommand) {
    return this.auth.revokeCurrentSession(command.sessionId);
  }
}
