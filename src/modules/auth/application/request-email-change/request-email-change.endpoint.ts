import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { EmailChangeRequestDto } from '../../auth.dto.ts';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { RequestEmailChangeCommand } from './request-email-change.command.ts';
import { RequestEmailChangeHandler } from './request-email-change.handler.ts';

@Controller()
export class RequestEmailChangeEndpoint {
  constructor(private readonly handler: RequestEmailChangeHandler) {}
  @Post('account/email-change-requests')
  @HttpCode(202)
  @UseGuards(SessionGuard)
  async request(@Body() input: EmailChangeRequestDto, @Req() request: AuthenticatedRequest & Request) {
    const session = request.authSession!;
    await this.handler.execute(new RequestEmailChangeCommand(session.accountId, session.id, input, request.ip ?? '', request.requestId!));
    return {};
  }
}
