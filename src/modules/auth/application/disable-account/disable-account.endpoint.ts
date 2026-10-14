import { Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { serializeSessionCookie } from '#common';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { DisableAccountCommand } from './disable-account.command.ts';
import { DisableAccountHandler } from './disable-account.handler.ts';

@Controller()
export class DisableAccountEndpoint {
  constructor(private readonly handler: DisableAccountHandler) {}
  @Post('account/disable')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async disable(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    const session = request.authSession!;
    await this.handler.execute(new DisableAccountCommand(session.accountId, session.id, request.requestId!));
    response.setHeader('Set-Cookie', serializeSessionCookie('', 0));
  }
}
