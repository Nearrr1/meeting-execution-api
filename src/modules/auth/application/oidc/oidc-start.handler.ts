import { Injectable } from '@nestjs/common';
import { OidcService } from './oidc.service.ts';

@Injectable()
export class OidcStartHandler {
  constructor(private readonly oidc: OidcService) {}

  execute(
    provider: 'google' | 'microsoft',
    intent: 'signin' | 'link' | 'reauth',
    session: { id: string; accountId: string } | undefined,
    returnTo: string | undefined,
  ) {
    return this.oidc.start(provider, intent, session, returnTo);
  }
}
