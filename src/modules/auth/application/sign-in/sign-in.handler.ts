import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { SignInCommand } from './sign-in.command.ts';

@Injectable()
export class SignInHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: SignInCommand) {
    return this.auth.signIn(command.email, command.password, command.sourceIp, command.requestId);
  }
}
