import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { EmailChangeVerifyDto } from './email-change-verify.dto.ts';
import { VerifyEmailChangeCommand } from './verify-email-change.command.ts';
import { VerifyEmailChangeHandler } from './verify-email-change.handler.ts';
@Controller()
export class VerifyEmailChangeEndpoint {
  constructor(private readonly handler: VerifyEmailChangeHandler) {}
  @Post('account/email-changes/verify')
  @HttpCode(204)
  async verify(@Body() input: EmailChangeVerifyDto, @Req() request: Request): Promise<void> {
    await this.handler.execute(new VerifyEmailChangeCommand(input.token, request.requestId!));
  }
}
