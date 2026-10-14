import type { EmailChangeInput } from '../email-change/index.ts';

export class RequestEmailChangeCommand {
  constructor(readonly accountId: string, readonly sessionId: string, readonly input: EmailChangeInput, readonly sourceIp: string, readonly requestId: string) {}
}
