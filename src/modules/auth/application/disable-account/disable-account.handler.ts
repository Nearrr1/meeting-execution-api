import { Injectable } from '@nestjs/common';
import { AccountLifecycleService } from '../account-lifecycle/index.ts';
import { DisableAccountCommand } from './disable-account.command.ts';

@Injectable()
export class DisableAccountHandler {
  constructor(private readonly lifecycle: AccountLifecycleService) {}
  execute(command: DisableAccountCommand): Promise<void> {
    return this.lifecycle.disableAccount(command.accountId, command.sessionId, command.requestId);
  }
}
