import { Body, Controller, HttpCode, Put, Req, UseGuards } from '@nestjs/common';
import { ChangePasswordDto } from '../../auth.dto.ts';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { ChangePasswordCommand } from './change-password.command.ts';
import { ChangePasswordHandler } from './change-password.handler.ts';

@Controller()
export class ChangePasswordEndpoint {
  constructor(private readonly handler: ChangePasswordHandler) {}
  @Put('account/password')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  changePassword(@Body() input: ChangePasswordDto, @Req() request: AuthenticatedRequest): Promise<void> {
    const session = request.authSession!;
    return this.handler.execute(new ChangePasswordCommand(session.accountId, session.id, input, request.requestId!));
  }
}
