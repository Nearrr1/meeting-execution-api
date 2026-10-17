import { Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { serializeSessionCookie } from '#common';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { RequestAccountDeletionCommand } from './request-account-deletion.command.ts';
import { RequestAccountDeletionHandler } from './request-account-deletion.handler.ts';
@Controller()
export class RequestAccountDeletionEndpoint {
  constructor(private readonly handler: RequestAccountDeletionHandler) {}
  @Post('account/deletion-requests') @HttpCode(202) @UseGuards(SessionGuard)
  async request(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.handler.execute(new RequestAccountDeletionCommand(request.authSession!.accountId, request.authSession!.id, request.requestId!));
    response.setHeader('Set-Cookie', serializeSessionCookie('', 0));
    return result;
  }
}
