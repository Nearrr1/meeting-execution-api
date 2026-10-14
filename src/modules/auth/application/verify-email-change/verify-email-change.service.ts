import { Injectable } from '@nestjs/common';
import { EmailChangeService } from '../email-change/index.ts';

@Injectable()
export class VerifyEmailChangeService {
  constructor(private readonly emailChange: EmailChangeService) {}
  execute(token: string, requestId: string) {
    return this.emailChange.verify(token, requestId);
  }
}
