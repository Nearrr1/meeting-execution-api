import type { VerifyEmailInput } from '../../auth.types.ts';
export class VerifyEmailCommand {
  constructor(
    readonly input: VerifyEmailInput,
    readonly requestId: string,
  ) {}
}
