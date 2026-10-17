import { Injectable } from '@nestjs/common';
import { ReauthenticateCommand } from './reauthenticate.command.ts';
import { ReauthenticationService } from './reauthentication.service.ts';
@Injectable()
export class ReauthenticateHandler {
  constructor(private readonly reauthentication: ReauthenticationService) {}
  execute(command: ReauthenticateCommand) {
    return this.reauthentication.execute(command);
  }
}
