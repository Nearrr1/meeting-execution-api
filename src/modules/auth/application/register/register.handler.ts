import { Injectable } from '@nestjs/common';
import { AuthService } from '../../services/index.ts';
import { RegisterCommand } from './register.command.ts';

@Injectable()
export class RegisterHandler {
  constructor(private readonly auth: AuthService) {}
  execute(command: RegisterCommand) {
    return this.auth.register(command.input, command.sourceIp, command.requestId);
  }
}
