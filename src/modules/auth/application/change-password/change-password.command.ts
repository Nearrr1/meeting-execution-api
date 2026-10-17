import type { ChangePasswordDto } from '../../auth.dto.ts';
export class ChangePasswordCommand {
  constructor(readonly accountId: string, readonly sessionId: string, readonly input: ChangePasswordDto, readonly requestId: string) {}
}
