export class RevokeSessionCommand {
  constructor(
    readonly accountId: string,
    readonly sessionId: string,
    readonly requestId: string,
  ) {}
}
