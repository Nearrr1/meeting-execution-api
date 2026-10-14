import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';

@Injectable()
export class SignInService {
  constructor(private readonly auth: AuthService) {}
  execute(email: string, password: string, sourceIp: string, requestId: string) {
    return this.auth.signIn(email, password, sourceIp, requestId);
  }
}
