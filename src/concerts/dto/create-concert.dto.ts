import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateConcertDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @IsString() @IsNotEmpty() band: string;
  @ApiProperty({ example: 'Rap' }) @IsString() @IsNotEmpty() genre: string;
  @ApiProperty({ example: '2026-12-05T20:00:00.000Z' }) @Type(() => Date) @IsDate() date: Date;
  @ApiProperty() @IsString() @IsNotEmpty() venue: string;
  @ApiProperty({ example: 500 }) @IsInt() @Min(1) totalSeats: number;
  @ApiProperty({ example: 15000 }) @IsNumber() @Min(0) price: number;
}