import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddFavoriteDto {
  @ApiProperty({ example: 'Himra' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  band: string;
}