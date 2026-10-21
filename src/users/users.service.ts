import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, QueryFilter } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { escapeRegex } from '../common/utils/escape-regex';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { USER_DELETED, type UserDeletedEvent } from './events/user-deleted.event';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private model: Model<UserDocument>,
    private events: EventEmitter2,
  ) {}

  async create(email: string, passwordHash: string, role: Role = Role.User) {
    try {
      return await this.model.create({ email, password: passwordHash, role });
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Email déjà utilisé');
      throw e;
    }
  }

  findByEmail(email: string, withPassword = false) {
    const q = this.model.findOne({ email: email.toLowerCase() });
    return withPassword ? q.select('+password') : q;
  }

  findById(id: string) {
    return this.model.findById(id);
  }

  async getById(id: string) {
    const user = await this.model.findById(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async findAll(q: QueryUserDto) {
    const filter: QueryFilter<UserDocument> = {};
    if (q.role) filter.role = q.role;
    if (q.search) filter.email = new RegExp(escapeRegex(q.search), 'i');

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      this.model.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  // Profil : l'utilisateur modifie son propre email / mot de passe
  async updateProfile(id: string, dto: UpdateProfileDto) {
    if (!dto.email && !dto.newPassword) {
      throw new BadRequestException('Rien à modifier : fournis un email ou un nouveau mot de passe');
    }
    const user = await this.model.findById(id).select('+password');
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (!(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }
    if (dto.email) user.email = dto.email;
    if (dto.newPassword) user.password = await bcrypt.hash(dto.newPassword, 10);
    return this.save(user);
  }

  // Admin
  async adminCreate(dto: { email: string; password: string; role?: Role }) {
    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.create(dto.email, hash, dto.role);
    return this.getById(user.id);
  }

  async adminUpdate(id: string, dto: { email?: string; password?: string }) {
    const user = await this.getById(id);
    if (dto.email) user.email = dto.email;
    if (dto.password) user.password = await bcrypt.hash(dto.password, 10);
    return this.save(user);
  }

  async setRole(id: string, role: Role) {
    const user = await this.getById(id);
    if (user.role === Role.Admin && role !== Role.Admin) {
      await this.ensureNotLastAdmin();
    }
    user.role = role;
    return this.save(user);
  }

  async remove(id: string) {
    const user = await this.getById(id);
    if (user.role === Role.Admin) await this.ensureNotLastAdmin();
    await user.deleteOne();

    const payload: UserDeletedEvent = { id };
    this.events.emit(USER_DELETED, payload);
  }

  private async ensureNotLastAdmin() {
    const admins = await this.model.countDocuments({ role: Role.Admin });
    if (admins <= 1) {
      throw new ConflictException('Impossible : il doit rester au moins un administrateur');
    }
  }

  // On renvoie toujours une version relue en base : jamais le hash du mot de passe
  private async save(user: UserDocument) {
    try {
      await user.save();
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Email déjà utilisé');
      throw e;
    }
    return this.getById(user.id);
  }
}