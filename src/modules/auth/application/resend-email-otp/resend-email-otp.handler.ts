import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { ResendEmailOtpCommand } from './resend-email-otp.command.ts';

@Injectable()
export class ResendEmailOtpHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: ResendEmailOtpCommand) {
    return this.auth.resendOtp(command.email, command.sourceIp, command.requestId);
  }
}
