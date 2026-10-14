import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import type { VerifyEmailInput } from '../../auth.types.ts';

@Injectable()
export class VerifyEmailService {
  constructor(private readonly auth: AuthService) {}
  execute(input: VerifyEmailInput, requestId: string) {
    return this.auth.verifyEmail(input, requestId);
  }
}
