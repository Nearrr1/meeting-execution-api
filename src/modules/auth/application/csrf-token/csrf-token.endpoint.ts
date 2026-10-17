import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CsrfTokenCommand } from './csrf-token.command.ts';
import { CsrfTokenHandler } from './csrf-token.handler.ts';
@Controller()
export class CsrfTokenEndpoint {
  constructor(private readonly handler: CsrfTokenHandler) {}
  @Get('auth/csrf-token')
  get(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const origin = request.headers.origin;
    return this.handler.execute(new CsrfTokenCommand(typeof origin === 'string' ? origin : undefined), (cookie) => response.setHeader('Set-Cookie', cookie), (name, value) => response.setHeader(name, value));
  }
}
