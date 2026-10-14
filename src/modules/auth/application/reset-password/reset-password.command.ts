import type { PasswordResetInput } from '../../auth.types.ts';

export class ResetPasswordCommand {
  constructor(
    readonly input: PasswordResetInput,
    readonly requestId: string,
  ) {}
}
