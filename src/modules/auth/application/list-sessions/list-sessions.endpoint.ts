import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { ListSessionsCommand } from './list-sessions.command.ts';
import { ListSessionsHandler } from './list-sessions.handler.ts';
@Controller()
export class ListSessionsEndpoint {
  constructor(private readonly handler: ListSessionsHandler) {}
  @Get('auth/sessions')
  @UseGuards(SessionGuard)
  list(@Req() request: AuthenticatedRequest) {
    return this.handler.execute(new ListSessionsCommand(request.authSession!.accountId));
  }
}
