import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import * as uploadedImageFile from '../common/types/uploaded-image-file';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { ConcertsService } from './concerts.service';
import { CreateConcertDto } from './dto/create-concert.dto';
import { QueryConcertDto } from './dto/query-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';

@ApiTags('concerts')
@Controller('concerts')
export class ConcertsController {
  constructor(private concerts: ConcertsService) {}

  @Get()
  findAll(@Query() query: QueryConcertDto) {
    return this.concerts.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.concerts.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateConcertDto) {
    return this.concerts.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post(':id/poster')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
          return cb(new BadRequestException('Formats acceptés : JPG, PNG, WebP'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadPoster(@Param('id', ParseObjectIdPipe) id: string, @UploadedFile() file: uploadedImageFile.UploadedImageFile) {
    if (!file) throw new BadRequestException('Fichier manquant');
    return this.concerts.setPoster(id, file);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch(':id')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateConcertDto) {
    return this.concerts.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.concerts.remove(id);
  }
}