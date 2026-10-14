import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PasswordResetDto } from '../../auth.dto.ts';
import { ResetPasswordCommand } from './reset-password.command.ts';
import { ResetPasswordHandler } from './reset-password.handler.ts';

@Controller()
export class ResetPasswordEndpoint {
  constructor(private readonly handler: ResetPasswordHandler) {}

  @Post('auth/password-resets')
  @HttpCode(204)
  async resetPassword(@Body() input: PasswordResetDto, @Req() request: Request): Promise<void> {
    await this.handler.execute(new ResetPasswordCommand(input, request.requestId!));
  }
}
