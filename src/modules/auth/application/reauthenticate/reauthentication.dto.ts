import { IsOptional, IsString, Matches } from 'class-validator';

export class ReauthenticationDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @Matches(/^(google|microsoft)$/)
  provider?: 'google' | 'microsoft';
}
