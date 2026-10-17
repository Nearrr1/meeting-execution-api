import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { ListSessionsCommand } from './list-sessions.command.ts';
@Injectable()
export class ListSessionsHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: ListSessionsCommand) { return this.auth.listSessions(command.accountId); }
}
