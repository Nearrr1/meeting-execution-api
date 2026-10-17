export class ResendEmailOtpCommand {
  constructor(
    readonly email: string,
    readonly sourceIp: string,
    readonly requestId: string,
  ) {}
}
