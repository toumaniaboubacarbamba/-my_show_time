import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema.js';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private model: Model<UserDocument>) {}

  create(email: string, passwordHash: string) {
    return this.model.create({ email, password: passwordHash });
  }

  findByEmail(email: string, withPassword = false) {
    const q = this.model.findOne({ email: email.toLowerCase() });
    return withPassword ? q.select('+password') : q;
  }

  findById(id: string) {
    return this.model.findById(id);
  }
}