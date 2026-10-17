import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString } from 'class-validator';

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
