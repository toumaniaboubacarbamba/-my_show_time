import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDate, IsInt, IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class TicketTierDto {
  @ApiProperty({ example: 'VIP' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  totalSeats: number;
}

export class CreateConcertDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @IsString() @IsNotEmpty() band: string;
  @ApiProperty({ example: 'Rap' }) @IsString() @IsNotEmpty() genre: string;
  @ApiProperty({ example: '2026-12-05T20:00:00.000Z' }) @Type(() => Date) @IsDate() date: Date;
  @ApiProperty() @IsString() @IsNotEmpty() venue: string;

  @ApiProperty({ type: [TicketTierDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TicketTierDto)
  tiers: TicketTierDto[];
}