import { Controller, Delete, HttpCode, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { serializeSessionCookie } from '#common';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { RevokeCurrentSessionCommand } from './revoke-current-session.command.ts';
import { RevokeCurrentSessionHandler } from './revoke-current-session.handler.ts';

@Controller()
export class RevokeCurrentSessionEndpoint {
  constructor(private readonly handler: RevokeCurrentSessionHandler) {}
  @Delete('auth/session')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async revoke(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.handler.execute(new RevokeCurrentSessionCommand(request.authSession!.id));
    response.setHeader('Set-Cookie', serializeSessionCookie('', 0));
  }
}
