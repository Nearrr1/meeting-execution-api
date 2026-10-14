import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import type { RegistrationInput } from '../../auth.types.ts';

@Injectable()
export class RegisterService {
  constructor(private readonly auth: AuthService) {}
  execute(input: RegistrationInput, sourceIp: string, requestId: string) {
    return this.auth.register(input, sourceIp, requestId);
  }
}
