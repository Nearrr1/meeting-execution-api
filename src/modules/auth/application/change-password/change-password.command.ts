import type { ChangePasswordDto } from './change-password.dto.ts';
export class ChangePasswordCommand {
  constructor(
    readonly accountId: string,
    readonly sessionId: string,
    readonly input: ChangePasswordDto,
    readonly requestId: string,
  ) {}
}
