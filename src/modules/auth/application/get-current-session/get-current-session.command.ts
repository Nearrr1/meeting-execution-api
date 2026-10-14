import type { AuthenticatedRequest } from '../../guards/index.ts';

export class GetCurrentSessionCommand {
  constructor(readonly session: NonNullable<AuthenticatedRequest['authSession']>) {}
}
