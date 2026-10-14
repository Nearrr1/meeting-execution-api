import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';

@Injectable()
export class ResendEmailOtpService {
  constructor(private readonly auth: AuthService) {}
  execute(email: string, sourceIp: string, requestId: string) {
    return this.auth.resendOtp(email, sourceIp, requestId);
  }
}
