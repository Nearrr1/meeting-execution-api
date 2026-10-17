import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiErrorCode } from '#common';
import { AuthService } from '../../services/index.ts';
import { OidcService } from '../oidc/index.ts';
import { ReauthenticateCommand } from './reauthenticate.command.ts';

@Injectable()
export class ReauthenticationService {
  constructor(
    private readonly auth: AuthService,
    private readonly oidc: OidcService,
  ) {}

  execute(command: ReauthenticateCommand) {
    if (command.input.provider && !command.input.currentPassword) {
      return this.oidc
        .start(command.input.provider, 'reauth', { accountId: command.accountId, id: command.sessionId }, '/')
        .then((oidcStart) => ({ status: 'reauthentication_required', ...oidcStart }));
    }
    if (!command.input.currentPassword || command.input.provider) {
      throw new BadRequestException({ code: ApiErrorCode.INVALID_REQUEST });
    }
    return this.auth.reauthenticateLocal(
      command.accountId,
      command.sessionId,
      command.input.currentPassword,
      command.requestId,
    );
  }
}
