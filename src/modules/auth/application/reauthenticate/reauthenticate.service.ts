import { Injectable, NotImplementedException } from '@nestjs/common';
import { ApiErrorCode } from '#common';
import { AuthService } from '../../services/index.ts';

@Injectable()
export class ReauthenticateService {
  constructor(private readonly auth: AuthService) {}
  execute(accountId: string, sessionId: string, password: string | undefined, provider: string | undefined, requestId: string) {
    if (!password || provider) throw new NotImplementedException({ code: ApiErrorCode.FEDERATED_REAUTHENTICATION_UNAVAILABLE });
    return this.auth.reauthenticateLocal(accountId, sessionId, password, requestId);
  }
}
