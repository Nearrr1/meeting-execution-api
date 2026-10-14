export class RequestPasswordRecoveryCommand {
  constructor(readonly email: string, readonly sourceIp: string, readonly requestId: string) {}
}
