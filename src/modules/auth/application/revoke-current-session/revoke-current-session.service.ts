import { Injectable } from '@nestjs/common';
import { AuthSessionService } from '../sessions/index.ts';

@Injectable()
export class RevokeCurrentSessionService {
  constructor(private readonly sessions: AuthSessionService) {}
  execute(sessionId: string) {
    return this.sessions.revoke(sessionId);
  }
}
