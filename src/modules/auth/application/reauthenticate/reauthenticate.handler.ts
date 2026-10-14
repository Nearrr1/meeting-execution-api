import { Injectable, NotImplementedException } from '@nestjs/common';
import { ApiErrorCode } from '#common';
import { AuthService } from '../../services/index.ts';
import { ReauthenticateCommand } from './reauthenticate.command.ts';

@Injectable()
export class ReauthenticateHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: ReauthenticateCommand): Promise<void> {
    if (!command.password || command.provider) throw new NotImplementedException({ code: ApiErrorCode.FEDERATED_REAUTHENTICATION_UNAVAILABLE });
    return this.auth.reauthenticateLocal(command.accountId, command.sessionId, command.password, command.requestId!);
  }
}
