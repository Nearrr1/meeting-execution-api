import { BadRequestException, Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../guards/index.ts';
import { OptionalSessionGuard } from '../../guards/index.ts';
import { OidcStartHandler } from './oidc-start.handler.ts';
import { serializeOidcTransactionCookie } from './oidc-transaction-cookie.ts';

@Controller('auth/oidc')
export class OidcStartEndpoint {
  constructor(private readonly handler: OidcStartHandler) {}

  @Get(':provider/start')
  @UseGuards(OptionalSessionGuard)
  async start(
    @Param() params: { provider: string },
    @Query() query: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    if (query.intent !== undefined && typeof query.intent !== 'string') throw new BadRequestException();
    if (query.returnTo !== undefined && typeof query.returnTo !== 'string') throw new BadRequestException();
    if (query.intent !== undefined && !['link', 'reauth'].includes(query.intent)) {
      throw new BadRequestException();
    }
    const intent = query.intent ?? 'signin';
    if (!['google', 'microsoft'].includes(params.provider)) throw new BadRequestException();
    const start = await this.handler.execute(
      params.provider as 'google' | 'microsoft',
      intent as 'signin' | 'link' | 'reauth',
      request.authSession,
      query.returnTo as string | undefined,
    );
    response.setHeader('Set-Cookie', serializeOidcTransactionCookie(start.state, start.browserBinding));
    response.redirect(302, start.authorizationUrl);
  }
}
