import type { ChangePasswordInput } from '../../auth.types.ts';

export class ChangePasswordCommand {
  constructor(readonly accountId: string, readonly sessionId: string, readonly input: ChangePasswordInput, readonly requestId: string) {}
}
