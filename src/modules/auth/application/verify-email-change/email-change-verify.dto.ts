import { IsString } from 'class-validator';

export class EmailChangeVerifyDto {
  @IsString()
  token!: string;
}
