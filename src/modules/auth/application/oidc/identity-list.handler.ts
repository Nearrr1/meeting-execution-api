import { Injectable } from '@nestjs/common';
import { OidcService } from './oidc.service.ts';

@Injectable()
export class IdentityListHandler {
  constructor(private readonly oidc: OidcService) {}

  execute(accountId: string) {
    return this.oidc.listIdentities(accountId);
  }
}
