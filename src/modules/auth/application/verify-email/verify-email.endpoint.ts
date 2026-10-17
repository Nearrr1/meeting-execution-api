import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TimeUnitMs, serializeSessionCookie } from '#common';
import { VerifyEmailDto } from '../../auth.dto.ts';
import { VerifyEmailCommand } from './verify-email.command.ts';
import { VerifyEmailHandler } from './verify-email.handler.ts';
@Controller()
export class VerifyEmailEndpoint {
  constructor(private readonly handler: VerifyEmailHandler) {}
  @Post('auth/registrations/verify-email')
  @HttpCode(200)
  async verify(@Body() input: VerifyEmailDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.handler.execute(new VerifyEmailCommand(input, request.requestId!));
    const absoluteExpiresAt = (result.accountSession.session as { absoluteExpiresAt: Date }).absoluteExpiresAt;
    const maxAgeSeconds = Math.max(0, Math.floor((absoluteExpiresAt.getTime() - Date.now()) / TimeUnitMs.SECOND));
    response.setHeader('Set-Cookie', serializeSessionCookie(result.sessionToken, maxAgeSeconds));
    return result.accountSession;
  }
}
