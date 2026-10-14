import { Injectable } from '@nestjs/common';
import { AuthSessionService } from '../sessions/index.ts';
import { RevokeSessionCommand } from './revoke-session.command.ts';

@Injectable()
export class RevokeSessionHandler {
  constructor(private readonly sessions: AuthSessionService) {}
  execute(command: RevokeSessionCommand): Promise<void> {
    return this.sessions.revokeOwned(command.accountId, command.sessionId);
  }
}
