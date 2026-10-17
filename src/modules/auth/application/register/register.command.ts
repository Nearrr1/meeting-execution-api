import type { RegistrationInput } from '../../auth.types.ts';

export class RegisterCommand {
  constructor(
    readonly input: RegistrationInput,
    readonly sourceIp: string,
    readonly requestId: string,
  ) {}
}
