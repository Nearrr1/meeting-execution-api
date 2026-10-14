export class ReauthenticateCommand {
  constructor(readonly accountId: string, readonly sessionId: string, readonly password?: string, readonly provider?: string, readonly requestId?: string) {}
}
