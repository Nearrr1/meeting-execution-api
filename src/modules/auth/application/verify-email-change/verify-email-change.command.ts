export class VerifyEmailChangeCommand {
  constructor(
    readonly token: string,
    readonly requestId: string,
  ) {}
}
