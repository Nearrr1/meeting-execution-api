import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.ts';
import { AuthService } from './services/index.ts';
import {
  AccountLifecycleService,
  AuthSessionService,
  ChangePasswordService,
  DisableAccountService,
  EmailChangeService,
  GetCurrentSessionService,
  ListSessionsService,
  ReauthenticateService,
  RegisterService,
  RequestAccountDeletionService,
  RequestEmailChangeService,
  RequestPasswordRecoveryService,
  ResendEmailOtpService,
  ResetPasswordService,
  RevokeCurrentSessionService,
  RevokeSessionService,
  ResetPasswordEndpoint,
  ResetPasswordHandler,
  SignInService,
  VerifyEmailChangeService,
  VerifyEmailService,
} from './application/index.ts';
import { EmailQuotaService } from '#email';
import { EmailDeliveryService } from '#email';
import { OriginAndCsrfGuard } from '#common';
import { SessionGuard } from './guards/index.ts';
import { AccountDeletionWorker } from '#workers';

@Module({
  controllers: [AuthController, ResetPasswordEndpoint],
  providers: [
    AuthService,
    RegisterService,
    ResendEmailOtpService,
    VerifyEmailService,
    SignInService,
    RequestPasswordRecoveryService,
    ResetPasswordHandler,
    ReauthenticateService,
    ChangePasswordService,
    RequestEmailChangeService,
    VerifyEmailChangeService,
    DisableAccountService,
    RequestAccountDeletionService,
    GetCurrentSessionService,
    ListSessionsService,
    RevokeCurrentSessionService,
    RevokeSessionService,
    AccountLifecycleService,
    AuthSessionService,
    EmailChangeService,
    EmailQuotaService,
    EmailDeliveryService,
    SessionGuard,
    AccountDeletionWorker,
    { provide: APP_GUARD, useClass: OriginAndCsrfGuard },
  ],
})
export class AuthModule {}
