import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryConcertDto {
  @ApiPropertyOptional({ description: 'Recherche libre (titre, groupe, lieu)' })
  @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() genre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() band?: string;

  @ApiPropertyOptional({ description: 'Un jour précis, ex: 2026-12-05' })
  @IsOptional() @Type(() => Date) @IsDate() date?: Date;

  @ApiPropertyOptional({ description: 'Début de période' })
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;

  @ApiPropertyOptional({ description: 'Fin de période' })
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}