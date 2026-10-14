import { Injectable } from '@nestjs/common';
import { AuthSessionService } from '../sessions/index.ts';
import { ListSessionsCommand } from './list-sessions.command.ts';

@Injectable()
export class ListSessionsHandler {
  constructor(private readonly sessions: AuthSessionService) {}
  execute(command: ListSessionsCommand) {
    return this.sessions.list(command.accountId);
  }
}
