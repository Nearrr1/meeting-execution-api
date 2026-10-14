import { Injectable } from '@nestjs/common';
import { AuthSessionService } from '../sessions/index.ts';

@Injectable()
export class RevokeSessionService {
  constructor(private readonly sessions: AuthSessionService) {}
  execute(accountId: string, sessionId: string) {
    return this.sessions.revokeOwned(accountId, sessionId);
  }
}
