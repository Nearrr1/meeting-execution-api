import { Injectable } from '@nestjs/common';
import { AccountLifecycleService } from '../account-lifecycle/index.ts';

@Injectable()
export class RequestAccountDeletionService {
  constructor(private readonly lifecycle: AccountLifecycleService) {}
  execute(accountId: string, sessionId: string, requestId: string) {
    return this.lifecycle.requestDeletion(accountId, sessionId, requestId);
  }
}
