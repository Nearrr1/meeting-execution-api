import { IsString } from 'class-validator';

export class PasswordResetDto {
  @IsString()
  token!: string;

  @IsString()
  newPassword!: string;

  @IsString()
  passwordConfirmation!: string;
}
