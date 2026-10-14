import { Injectable } from '@nestjs/common';
import { AuthSessionService } from '../sessions/index.ts';
import { RevokeCurrentSessionCommand } from './revoke-current-session.command.ts';

@Injectable()
export class RevokeCurrentSessionHandler {
  constructor(private readonly sessions: AuthSessionService) {}
  execute(command: RevokeCurrentSessionCommand): Promise<void> {
    return this.sessions.revoke(command.sessionId);
  }
}
