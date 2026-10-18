export class RevokeCurrentSessionCommand {
  constructor(
    readonly sessionId: string,
    readonly requestId: string,
  ) {}
}
