import { Controller, Get, InternalServerErrorException, Req, Res } from '@nestjs/common';
import { ApiErrorCode } from '#common';
import { TimeUnitMs } from '#common';
import type { Request, Response } from 'express';
import { getRuntimeConfig } from '#config';
import { serializeSessionCookie } from '#common';
import { cookieValue } from '#common';
import { OidcCallbackHandler } from './oidc-callback.handler.ts';
import { oidcTransactionCookieName, serializeOidcTransactionCookie } from './oidc-transaction-cookie.ts';

@Controller('auth/oidc')
export class OidcCallbackEndpoint {
  constructor(private readonly handler: OidcCallbackHandler) {}

  @Get('callback')
  async callback(@Req() request: Request, @Res() response: Response): Promise<void> {
    const oidcConfig = getRuntimeConfig().oidc;
    if (!oidcConfig) {
      throw new InternalServerErrorException({ code: ApiErrorCode.AUTHENTICATION_NOT_CONFIGURED });
    }
    const callbackUrl = new URL(oidcConfig.callbackUrl);
    for (const key of ['code', 'state', 'iss', 'error']) {
      const value = request.query[key];
      if (typeof value === 'string') callbackUrl.searchParams.set(key, value);
    }
    const stateValue = request.query.state;
    const state = typeof stateValue === 'string' ? stateValue : undefined;
    const binding = state ? cookieValue(request, oidcTransactionCookieName(state)) : undefined;
    try {
      const result = await this.handler.execute(callbackUrl, request.requestId ?? '', binding);
      const cookies = [serializeOidcTransactionCookie(state!, '', true)];
      if (result.sessionToken) {
        cookies.push(serializeSessionCookie(result.sessionToken, (30 * TimeUnitMs.DAY) / 1000));
      }
      response.setHeader('Set-Cookie', cookies);
      response.redirect(302, result.redirectTo);
    } catch (error) {
      if (state) response.setHeader('Set-Cookie', serializeOidcTransactionCookie(state, '', true));
      throw error;
    }
  }
}
