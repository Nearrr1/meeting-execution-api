import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ResendOtpDto } from '../../auth.dto.ts';
import { RequestPasswordRecoveryCommand } from './request-password-recovery.command.ts';
import { RequestPasswordRecoveryHandler } from './request-password-recovery.handler.ts';
@Controller()
export class RequestPasswordRecoveryEndpoint {
  constructor(private readonly handler: RequestPasswordRecoveryHandler) {}
  @Post('auth/password-recovery-requests')
  @HttpCode(202)
  async request(@Body() input: ResendOtpDto, @Req() request: Request) {
    await this.handler.execute(new RequestPasswordRecoveryCommand(input.email, request.ip ?? '', request.requestId!));
    return {};
  }
}
