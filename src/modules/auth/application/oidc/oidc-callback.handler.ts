import { Injectable } from '@nestjs/common';
import { OidcService } from './oidc.service.ts';

@Injectable()
export class OidcCallbackHandler {
  constructor(private readonly oidc: OidcService) {}

  execute(callbackUrl: URL, requestId: string, browserBinding: string | undefined) {
    return this.oidc.complete(callbackUrl, requestId, browserBinding);
  }
}
