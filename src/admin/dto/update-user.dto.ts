import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// Le rôle se change via sa propre route, pour garder les règles de sécurité au même endroit
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['role'] as const)) {}
