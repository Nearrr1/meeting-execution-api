import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { GetCurrentSessionCommand } from './get-current-session.command.ts';
@Injectable()
export class GetCurrentSessionHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: GetCurrentSessionCommand) { return this.auth.currentSession(command.session); }
}
