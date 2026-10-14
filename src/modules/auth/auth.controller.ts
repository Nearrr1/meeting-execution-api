import { ApiErrorCode } from '#common';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ChangePasswordService,
  DisableAccountService,
  GetCurrentSessionService,
  ListSessionsService,
  ReauthenticateService,
  RegisterService,
  RequestAccountDeletionService,
  RequestEmailChangeService,
  RequestPasswordRecoveryService,
  ResendEmailOtpService,
  RevokeCurrentSessionService,
  RevokeSessionService,
  SignInService,
  VerifyEmailChangeService,
  VerifyEmailService,
} from './application/index.ts';
import {
  ChangePasswordDto,
  EmailChangeRequestDto,
  EmailChangeVerifyDto,
  ReauthenticationDto,
  RegistrationDto,
  ResendOtpDto,
  SignInDto,
  VerifyEmailDto,
} from './auth.dto.ts';
import { csrfCookie, newCsrfToken } from '#common';
import { AuthenticatedRequest, SessionGuard } from './guards/index.ts';
import { TimeUnitMs } from '#common';
import { serializeSessionCookie } from '#common';

@Controller()
export class AuthController {
  constructor(
    private readonly registerService: RegisterService,
    private readonly resendEmailOtpService: ResendEmailOtpService,
    private readonly verifyEmailService: VerifyEmailService,
    private readonly signInService: SignInService,
    private readonly requestPasswordRecoveryService: RequestPasswordRecoveryService,
    private readonly reauthenticateService: ReauthenticateService,
    private readonly changePasswordService: ChangePasswordService,
    private readonly requestEmailChangeService: RequestEmailChangeService,
    private readonly verifyEmailChangeService: VerifyEmailChangeService,
    private readonly disableAccountService: DisableAccountService,
    private readonly requestAccountDeletionService: RequestAccountDeletionService,
    private readonly getCurrentSessionService: GetCurrentSessionService,
    private readonly listSessionsService: ListSessionsService,
    private readonly revokeCurrentSessionService: RevokeCurrentSessionService,
    private readonly revokeSessionService: RevokeSessionService,
  ) {}

  @Get('auth/csrf-token')
  getCsrfToken(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const origin = request.headers.origin;
    if (typeof origin === 'string') {
      const allowed = (process.env.WEB_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
      if (!allowed.includes(origin)) throw new ForbiddenException({ code: ApiErrorCode.ORIGIN_NOT_ALLOWED });
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Vary', 'Origin');
    }
    const token = newCsrfToken();
    response.setHeader('Set-Cookie', csrfCookie(token));
    return { csrfToken: token };
  }

  @Post('auth/registrations')
  @HttpCode(202)
  register(@Body() input: RegistrationDto, @Req() request: Request) {
    return this.registerService.execute(input, request.ip ?? '', request.requestId!);
  }

  @Post('auth/registrations/resend-email-otp')
  @HttpCode(202)
  async resend(@Body() input: ResendOtpDto, @Req() request: Request) {
    await this.resendEmailOtpService.execute(input.email, request.ip ?? '', request.requestId!);
    return {};
  }

  @Post('auth/registrations/verify-email')
  @HttpCode(200)
  async verify(@Body() input: VerifyEmailDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.verifyEmailService.execute(input, request.requestId!);
    const absoluteExpiresAt = (result.accountSession.session as { absoluteExpiresAt: Date }).absoluteExpiresAt;
    const maxAgeSeconds = Math.max(0, Math.floor((absoluteExpiresAt.getTime() - Date.now()) / TimeUnitMs.SECOND));
    response.setHeader('Set-Cookie', serializeSessionCookie(result.sessionToken, maxAgeSeconds));
    return result.accountSession;
  }

  @Post('auth/sessions')
  @HttpCode(201)
  async signIn(@Body() input: SignInDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.signInService.execute(input.email, input.password, request.ip ?? '', request.requestId!);
    const absoluteExpiresAt = (result.accountSession.session as { absoluteExpiresAt: Date }).absoluteExpiresAt;
    const maxAgeSeconds = Math.max(0, Math.floor((absoluteExpiresAt.getTime() - Date.now()) / TimeUnitMs.SECOND));
    response.setHeader('Set-Cookie', serializeSessionCookie(result.sessionToken, maxAgeSeconds));
    return result.accountSession;
  }

  @Post('auth/password-recovery-requests')
  @HttpCode(202)
  async requestPasswordRecovery(@Body() input: ResendOtpDto, @Req() request: Request) {
    await this.requestPasswordRecoveryService.execute(input.email, request.ip ?? '', request.requestId!);
    return {};
  }

  @Post('auth/reauth')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async reauthenticate(@Body() input: ReauthenticationDto, @Req() request: AuthenticatedRequest): Promise<void> {
    await this.reauthenticateService.execute(
      request.authSession!.accountId,
      request.authSession!.id,
      input.currentPassword,
      input.provider,
      request.requestId!,
    );
  }

  @Put('account/password')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async changePassword(@Body() input: ChangePasswordDto, @Req() request: AuthenticatedRequest): Promise<void> {
    await this.changePasswordService.execute(
      request.authSession!.accountId,
      request.authSession!.id,
      input,
      request.requestId!,
    );
  }

  @Post('account/email-change-requests')
  @HttpCode(202)
  @UseGuards(SessionGuard)
  async requestEmailChange(@Body() input: EmailChangeRequestDto, @Req() request: AuthenticatedRequest) {
    await this.requestEmailChangeService.execute(
      request.authSession!.accountId,
      request.authSession!.id,
      input,
      request.ip ?? '',
      request.requestId!,
    );
    return {};
  }

  @Post('account/email-changes/verify')
  @HttpCode(204)
  async verifyEmailChange(@Body() input: EmailChangeVerifyDto, @Req() request: Request): Promise<void> {
    await this.verifyEmailChangeService.execute(input.token, request.requestId!);
  }

  @Post('account/disable')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async disableAccount(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.disableAccountService.execute(request.authSession!.accountId, request.authSession!.id, request.requestId!);
    response.setHeader('Set-Cookie', serializeSessionCookie('', 0));
  }

  @Post('account/deletion-requests')
  @HttpCode(202)
  @UseGuards(SessionGuard)
  async requestAccountDeletion(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.requestAccountDeletionService.execute(request.authSession!.accountId, request.authSession!.id, request.requestId!);
    response.setHeader('Set-Cookie', serializeSessionCookie('', 0));
    return result;
  }

  @Get('auth/session')
  @UseGuards(SessionGuard)
  getCurrent(@Req() request: AuthenticatedRequest) {
    return this.getCurrentSessionService.execute(request.authSession!);
  }

  @Get('auth/sessions')
  @UseGuards(SessionGuard)
  listSessions(@Req() request: AuthenticatedRequest) {
    return this.listSessionsService.execute(request.authSession!.accountId);
  }

  @Delete('auth/session')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async revokeCurrent(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.revokeCurrentSessionService.execute(request.authSession!.id);
    response.setHeader('Set-Cookie', serializeSessionCookie('', 0));
  }

  @Delete('auth/sessions/:sessionId')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async revokeOwned(@Req() request: AuthenticatedRequest, @Param('sessionId', new ParseUUIDPipe()) sessionId: string): Promise<void> {
    await this.revokeSessionService.execute(request.authSession!.accountId, sessionId);
  }
}
