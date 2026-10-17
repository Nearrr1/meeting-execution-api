import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { RequestAccountDeletionCommand } from './request-account-deletion.command.ts';
@Injectable()
export class RequestAccountDeletionHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: RequestAccountDeletionCommand) {
    return this.auth.requestAccountDeletion(command.accountId, command.sessionId, command.requestId);
  }
}
