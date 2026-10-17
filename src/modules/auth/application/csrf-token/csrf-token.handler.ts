import { Injectable } from '@nestjs/common';
import { CsrfTokenService } from './csrf-token.service.ts';
import { CsrfTokenCommand } from './csrf-token.command.ts';
@Injectable()
export class CsrfTokenHandler {
  constructor(private readonly service: CsrfTokenService) {}
  execute(command: CsrfTokenCommand, setCookie: (cookie: string) => void, setHeader: (name: string, value: string) => void) {
    return this.service.execute(command, setCookie, setHeader);
  }
}
