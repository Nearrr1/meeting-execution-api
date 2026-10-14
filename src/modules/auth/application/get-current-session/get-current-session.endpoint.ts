import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { GetCurrentSessionCommand } from './get-current-session.command.ts';
import { GetCurrentSessionHandler } from './get-current-session.handler.ts';

@Controller()
export class GetCurrentSessionEndpoint {
  constructor(private readonly handler: GetCurrentSessionHandler) {}
  @Get('auth/session')
  @UseGuards(SessionGuard)
  current(@Req() request: AuthenticatedRequest) {
    return this.handler.execute(new GetCurrentSessionCommand(request.authSession!));
  }
}
