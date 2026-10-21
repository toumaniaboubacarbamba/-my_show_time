import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { USER_DELETED, type UserDeletedEvent } from '../users/events/user-deleted.event';
import { Favorite, FavoriteDocument } from './favorite.schema';

@Injectable()
export class FavoritesService {
  constructor(@InjectModel(Favorite.name) private model: Model<FavoriteDocument>) {}

  private key(band: string) {
    return band.trim().toLowerCase();
  }

  async add(userId: string, band: string) {
    try {
      return await this.model.create({
        user: userId,
        band: band.trim(),
        bandKey: this.key(band),
      });
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Groupe déjà dans tes favoris');
      throw e;
    }
  }

  findByUser(userId: string) {
    return this.model.find({ user: userId }).sort({ band: 1 });
  }

  async remove(userId: string, id: string) {
    const res = await this.model.findOneAndDelete({ _id: id, user: userId });
    if (!res) throw new NotFoundException('Favori introuvable');
  }

  async findUserIdsByBand(band: string) {
    const favorites = await this.model.find({ bandKey: this.key(band) }).select('user');
    return favorites.map((f) => f.user);
  }

  @OnEvent(USER_DELETED)
  async onUserDeleted(event: UserDeletedEvent) {
    await this.model.deleteMany({ user: event.id });
  }
}