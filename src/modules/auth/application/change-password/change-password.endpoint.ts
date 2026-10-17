import { Body, Controller, HttpCode, Put, Req, UseGuards } from '@nestjs/common';
import { ChangePasswordDto } from './change-password.dto.ts';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { ChangePasswordCommand } from './change-password.command.ts';
import { ChangePasswordHandler } from './change-password.handler.ts';
@Controller()
export class ChangePasswordEndpoint {
  constructor(private readonly handler: ChangePasswordHandler) {}
  @Put('account/password')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async change(@Body() input: ChangePasswordDto, @Req() request: AuthenticatedRequest): Promise<void> {
    await this.handler.execute(
      new ChangePasswordCommand(
        request.authSession!.accountId,
        request.authSession!.id,
        input,
        request.requestId!,
      ),
    );
  }
}
