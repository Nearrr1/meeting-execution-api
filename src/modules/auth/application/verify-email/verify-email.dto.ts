import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
