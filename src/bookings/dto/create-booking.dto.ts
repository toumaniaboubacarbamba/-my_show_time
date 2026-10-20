import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, Max, Min } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: '6ad78066218c25e26f854c81' })
  @IsMongoId()
  concertId: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  quantity: number;
}
