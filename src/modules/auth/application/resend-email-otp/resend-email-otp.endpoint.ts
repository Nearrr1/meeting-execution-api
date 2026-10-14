import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ResendOtpDto } from '../../auth.dto.ts';
import { ResendEmailOtpCommand } from './resend-email-otp.command.ts';
import { ResendEmailOtpHandler } from './resend-email-otp.handler.ts';

@Controller()
export class ResendEmailOtpEndpoint {
  constructor(private readonly handler: ResendEmailOtpHandler) {}
  @Post('auth/registrations/resend-email-otp')
  @HttpCode(202)
  async resend(@Body() input: ResendOtpDto, @Req() request: Request) {
    await this.handler.execute(new ResendEmailOtpCommand(input.email, request.ip ?? '', request.requestId!));
    return {};
  }
}
