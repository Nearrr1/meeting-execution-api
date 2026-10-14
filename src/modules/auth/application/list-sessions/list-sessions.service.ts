import { Injectable } from '@nestjs/common';
import { AuthSessionService } from '../sessions/index.ts';

@Injectable()
export class ListSessionsService {
  constructor(private readonly sessions: AuthSessionService) {}
  execute(accountId: string) {
    return this.sessions.list(accountId);
  }
}
