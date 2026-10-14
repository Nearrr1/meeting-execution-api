import { Controller, Delete, HttpCode, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { RevokeSessionCommand } from './revoke-session.command.ts';
import { RevokeSessionHandler } from './revoke-session.handler.ts';

@Controller()
export class RevokeSessionEndpoint {
  constructor(private readonly handler: RevokeSessionHandler) {}
  @Delete('auth/sessions/:sessionId')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  revoke(@Req() request: AuthenticatedRequest, @Param('sessionId', new ParseUUIDPipe()) sessionId: string): Promise<void> {
    return this.handler.execute(new RevokeSessionCommand(request.authSession!.accountId, sessionId));
  }
}
