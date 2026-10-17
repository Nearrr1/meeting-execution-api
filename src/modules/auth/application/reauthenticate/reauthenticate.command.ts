import type { ReauthenticationDto } from './reauthentication.dto.ts';
export class ReauthenticateCommand {
  constructor(
    readonly accountId: string,
    readonly sessionId: string,
    readonly input: ReauthenticationDto,
    readonly requestId: string,
  ) {}
}
