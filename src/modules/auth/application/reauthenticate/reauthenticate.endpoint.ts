import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ReauthenticationDto } from '../../auth.dto.ts';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { ReauthenticateCommand } from './reauthenticate.command.ts';
import { ReauthenticateHandler } from './reauthenticate.handler.ts';
@Controller()
export class ReauthenticateEndpoint {
  constructor(private readonly handler: ReauthenticateHandler) {}
  @Post('auth/reauth') @HttpCode(204) @UseGuards(SessionGuard)
  async reauthenticate(@Body() input: ReauthenticationDto, @Req() request: AuthenticatedRequest): Promise<void> {
    await this.handler.execute(new ReauthenticateCommand(request.authSession!.accountId, request.authSession!.id, input, request.requestId!));
  }
}
