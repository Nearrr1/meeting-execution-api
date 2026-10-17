import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { Req } from '@nestjs/common';
import { IdentityListHandler } from './identity-list.handler.ts';

@Controller('account/identities')
@UseGuards(SessionGuard)
export class IdentityListEndpoint {
  constructor(private readonly handler: IdentityListHandler) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.handler.execute(request.authSession!.accountId);
  }
}
