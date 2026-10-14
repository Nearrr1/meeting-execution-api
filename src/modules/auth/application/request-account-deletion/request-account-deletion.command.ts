export class RequestAccountDeletionCommand {
  constructor(readonly accountId: string, readonly sessionId: string, readonly requestId: string) {}
}
