import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';

@Injectable()
export class RequestPasswordRecoveryService {
  constructor(private readonly auth: AuthService) {}
  execute(email: string, sourceIp: string, requestId: string) {
    return this.auth.requestPasswordRecovery(email, sourceIp, requestId);
  }
}
