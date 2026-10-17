import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TimeUnitMs, serializeSessionCookie } from '#common';
import { SignInDto } from '../../auth.dto.ts';
import { SignInCommand } from './sign-in.command.ts';
import { SignInHandler } from './sign-in.handler.ts';
@Controller()
export class SignInEndpoint {
  constructor(private readonly handler: SignInHandler) {}
  @Post('auth/sessions')
  @HttpCode(201)
  async signIn(@Body() input: SignInDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.handler.execute(new SignInCommand(input.email, input.password, request.ip ?? '', request.requestId!));
    const absoluteExpiresAt = (result.accountSession.session as { absoluteExpiresAt: Date }).absoluteExpiresAt;
    const maxAgeSeconds = Math.max(0, Math.floor((absoluteExpiresAt.getTime() - Date.now()) / TimeUnitMs.SECOND));
    response.setHeader('Set-Cookie', serializeSessionCookie(result.sessionToken, maxAgeSeconds));
    return result.accountSession;
  }
}
