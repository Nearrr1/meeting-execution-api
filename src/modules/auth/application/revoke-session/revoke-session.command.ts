export class RevokeSessionCommand {
  constructor(
    readonly accountId: string,
    readonly sessionId: string,
  ) {}
}
