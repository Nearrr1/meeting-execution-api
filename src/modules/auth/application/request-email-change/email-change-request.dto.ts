import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class EmailChangeRequestDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  newEmail!: string;
}
