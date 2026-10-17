import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { serializeOidcTransactionCookie } from '../oidc/oidc-transaction-cookie.ts';
import { ReauthenticationDto } from './reauthentication.dto.ts';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { ReauthenticateCommand } from './reauthenticate.command.ts';
import { ReauthenticateHandler } from './reauthenticate.handler.ts';
@Controller()
export class ReauthenticateEndpoint {
  constructor(private readonly handler: ReauthenticateHandler) {}
  @Post('auth/reauth')
  @UseGuards(SessionGuard)
  async reauthenticate(
    @Body() input: ReauthenticationDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.handler.execute(
      new ReauthenticateCommand(
        request.authSession!.accountId,
        request.authSession!.id,
        input,
        request.requestId!,
      ),
    );
    if (result && typeof result === 'object' && 'authorizationUrl' in result) {
      response.setHeader('Set-Cookie', serializeOidcTransactionCookie(result.state, result.browserBinding));
      response.status(200).json({ status: result.status, authorizationUrl: result.authorizationUrl });
      return;
    }
    response.status(204).send();
  }
}
