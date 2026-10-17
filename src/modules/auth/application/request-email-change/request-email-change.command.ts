import type { EmailChangeRequestDto } from '../../auth.dto.ts';
export class RequestEmailChangeCommand {
  constructor(readonly accountId: string, readonly sessionId: string, readonly input: EmailChangeRequestDto, readonly sourceIp: string, readonly requestId: string) {}
}
