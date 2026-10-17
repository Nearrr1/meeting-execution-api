import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

export class SignInDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
