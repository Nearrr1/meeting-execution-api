import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import type { ChangePasswordInput } from '../../auth.types.ts';

@Injectable()
export class ChangePasswordService {
  constructor(private readonly auth: AuthService) {}
  execute(accountId: string, sessionId: string, input: ChangePasswordInput, requestId: string) {
    return this.auth.changePassword(accountId, sessionId, input, requestId);
  }
}
