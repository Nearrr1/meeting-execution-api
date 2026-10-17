export class DisableAccountCommand {
  constructor(
    readonly accountId: string,
    readonly sessionId: string,
    readonly requestId: string,
  ) {}
}
