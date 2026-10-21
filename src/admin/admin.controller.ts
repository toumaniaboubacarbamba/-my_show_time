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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import type { AuthUser } from '../common/types/auth-user.type';
import { QueryUserDto } from '../users/dto/query-user.dto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@Controller('admin')
export class AdminController {
  constructor(private users: UsersService) {}

  @Get('users')
  list(@Query() query: QueryUserDto) {
    return this.users.findAll(query);
  }

  @Get('users/:id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.users.getById(id);
  }

  @Post('users')
  create(@Body() dto: CreateUserDto) {
    return this.users.adminCreate(dto);
  }

  @Patch('users/:id')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.adminUpdate(id, dto);
  }

  @Patch('users/:id/role')
  setRole(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.users.setRole(id, dto.role);
  }

  @Delete('users/:id')
  @HttpCode(204)
  remove(@CurrentUser() current: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    if (id === current.userId) {
      throw new BadRequestException('Tu ne peux pas supprimer ton propre compte');
    }
    return this.users.remove(id);
  }
}
