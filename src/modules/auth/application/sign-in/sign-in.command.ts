export class SignInCommand {
  constructor(
    readonly email: string,
    readonly password: string,
    readonly sourceIp: string,
    readonly requestId: string,
  ) {}
}
