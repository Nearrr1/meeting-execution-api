import { Injectable } from '@nestjs/common';
import { AuthSessionService } from '../sessions/index.ts';
import type { AuthenticatedRequest } from '../../guards/index.ts';

@Injectable()
export class GetCurrentSessionService {
  constructor(private readonly sessions: AuthSessionService) {}
  execute(session: NonNullable<AuthenticatedRequest['authSession']>) {
    return this.sessions.current(session);
  }
}
