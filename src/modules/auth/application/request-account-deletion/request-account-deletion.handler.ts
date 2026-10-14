import { Injectable } from '@nestjs/common';
import { AccountLifecycleService } from '../account-lifecycle/index.ts';
import { RequestAccountDeletionCommand } from './request-account-deletion.command.ts';

@Injectable()
export class RequestAccountDeletionHandler {
  constructor(private readonly lifecycle: AccountLifecycleService) {}
  execute(command: RequestAccountDeletionCommand) {
    return this.lifecycle.requestDeletion(command.accountId, command.sessionId, command.requestId);
  }
}
