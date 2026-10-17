import { Injectable } from '@nestjs/common';
import { OidcService } from './oidc.service.ts';

@Injectable()
export class IdentityUnlinkHandler {
  constructor(private readonly oidc: OidcService) {}

  execute(accountId: string, sessionId: string, identityId: string, requestId: string) {
    return this.oidc.unlinkIdentity(accountId, sessionId, identityId, requestId);
  }
}
