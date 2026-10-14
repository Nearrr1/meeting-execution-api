import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class RegistrationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsString()
  passwordConfirmation!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  displayName?: string;
}

export class VerifyEmailDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ResendOtpDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email!: string;
}

export class SignInDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class PasswordResetDto {
  @IsString()
  token!: string;

  @IsString()
  newPassword!: string;

  @IsString()
  passwordConfirmation!: string;
}

export class ReauthenticationDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @Matches(/^(google|microsoft)$/)
  provider?: 'google' | 'microsoft';
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  newPassword!: string;

  @IsString()
  passwordConfirmation!: string;
}

export class EmailChangeRequestDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  newEmail!: string;
}

export class EmailChangeVerifyDto {
  @IsString()
  token!: string;
}
