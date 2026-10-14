import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import type { PasswordResetInput } from '../../auth.types.ts';

@Injectable()
export class ResetPasswordService {
  constructor(private readonly auth: AuthService) {}
  execute(input: PasswordResetInput, requestId: string) {
    return this.auth.resetPassword(input, requestId);
  }
}
