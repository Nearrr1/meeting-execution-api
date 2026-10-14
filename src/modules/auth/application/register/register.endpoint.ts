import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RegistrationDto } from '../../auth.dto.ts';
import { RegisterCommand } from './register.command.ts';
import { RegisterHandler } from './register.handler.ts';

@Controller()
export class RegisterEndpoint {
  constructor(private readonly handler: RegisterHandler) {}
  @Post('auth/registrations')
  @HttpCode(202)
  register(@Body() input: RegistrationDto, @Req() request: Request) {
    return this.handler.execute(new RegisterCommand(input, request.ip ?? '', request.requestId!));
  }
}
