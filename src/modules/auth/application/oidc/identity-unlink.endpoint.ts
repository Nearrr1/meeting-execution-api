import { Controller, Delete, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedRequest, SessionGuard } from '../../guards/index.ts';
import { IdentityUnlinkHandler } from './identity-unlink.handler.ts';

@Controller('account/identities')
@UseGuards(SessionGuard)
export class IdentityUnlinkEndpoint {
  constructor(private readonly handler: IdentityUnlinkHandler) {}

  @Delete(':identityId')
  async unlink(
    @Param('identityId') identityId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.handler.execute(
      request.authSession!.accountId,
      request.authSession!.id,
      identityId,
      request.requestId ?? '',
    );
    response.status(204).send();
  }
}
