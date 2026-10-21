import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CONCERT_CREATED, type ConcertCreatedEvent } from '../concerts/events/concert-created.event';
import { CONCERT_DELETED, type ConcertDeletedEvent } from '../concerts/events/concert-deleted.event';
import { FavoritesService } from '../favorites/favorites.service';
import { USER_DELETED, type UserDeletedEvent } from '../users/events/user-deleted.event';
import { Notification, NotificationDocument } from './notification.schema';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name) private model: Model<NotificationDocument>,
    private favorites: FavoritesService,
  ) {}

  @OnEvent(CONCERT_CREATED)
  async onConcertCreated(event: ConcertCreatedEvent) {
    try {
      const userIds = await this.favorites.findUserIdsByBand(event.band);
      if (userIds.length === 0) return;

      const date = new Date(event.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const message = `${event.band} est programmé le ${date} à ${event.venue}`;

      await this.model.insertMany(
        userIds.map((user) => ({ user, concert: event.id, message })),
      );
      this.logger.log(`${userIds.length} notification(s) créée(s) pour ${event.band}`);
    } catch (err) {
      this.logger.error('Échec de création des notifications', err as Error);
    }
  }

  @OnEvent(USER_DELETED)
  async onUserDeleted(event: UserDeletedEvent) {
    await this.model.deleteMany({ user: event.id });
  }

  @OnEvent(CONCERT_DELETED)
  async onConcertDeleted(event: ConcertDeletedEvent) {
    await this.model.deleteMany({ concert: event.id });
  }

  findMine(userId: string) {
    return this.model
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('concert', 'title band date venue');
  }

  async markRead(userId: string, id: string) {
    const notification = await this.model.findOneAndUpdate(
      { _id: id, user: userId },
      { read: true },
      { new: true },
    );
    if (!notification) throw new NotFoundException('Notification introuvable');
    return notification;
  }

  markAllRead(userId: string) {
    return this.model.updateMany({ user: userId, read: false }, { read: true });
  }
}