import { Injectable } from '@nestjs/common';
import { AuthSessionService } from '../sessions/index.ts';
import { GetCurrentSessionCommand } from './get-current-session.command.ts';

@Injectable()
export class GetCurrentSessionHandler {
  constructor(private readonly sessions: AuthSessionService) {}
  execute(command: GetCurrentSessionCommand) {
    return this.sessions.current(command.session);
  }
}
