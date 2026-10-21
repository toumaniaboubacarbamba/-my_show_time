import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as QRCode from 'qrcode';
import { ConcertsService } from '../concerts/concerts.service';
import { CONCERT_DELETED, type ConcertDeletedEvent } from '../concerts/events/concert-deleted.event';
import { USER_DELETED, type UserDeletedEvent } from '../users/events/user-deleted.event';
import { BookingStatus } from './booking-status.enum';
import { Booking, BookingDocument } from './booking.schema';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private model: Model<BookingDocument>,
    private concerts: ConcertsService,
    private config: ConfigService,
  ) {}

  private link(reference: string) {
    const base = this.config.get<string>('PUBLIC_URL', 'http://localhost:3000');
    return `${base}/bookings/verify/${reference}`;
  }

  @OnEvent(CONCERT_DELETED)
  async onConcertDeleted(event: ConcertDeletedEvent) {
    await this.model.updateMany(
      { concert: event.id, status: BookingStatus.Confirmed },
      { status: BookingStatus.Cancelled },
    );
  }

  @OnEvent(USER_DELETED)
  async onUserDeleted(event: UserDeletedEvent) {
    const active = await this.model.find({ user: event.id, status: BookingStatus.Confirmed });
    for (const booking of active) {
      const cancelled = await this.model.findOneAndUpdate(
        { _id: booking._id, status: BookingStatus.Confirmed },
        { status: BookingStatus.Cancelled },
      );
      if (cancelled) {
        await this.concerts.releaseSeats(booking.concert.toString(), booking.quantity);
      }
    }
  }

  async create(userId: string, dto: CreateBookingDto) {
    const concert = await this.concerts.reserveSeats(dto.concertId, dto.quantity);
    try {
      const booking = await this.model.create({
        user: userId,
        concert: concert._id,
        quantity: dto.quantity,
        totalPrice: concert.price * dto.quantity,
      });
      return { ...booking.toObject(), link: this.link(booking.reference) };
    } catch (err) {
      // La réservation n'a pas pu être enregistrée : on rend les places
      await this.concerts.releaseSeats(dto.concertId, dto.quantity);
      throw err;
    }
  }

  findMine(userId: string) {
    return this.model
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('concert', 'title band date venue');
  }

  async cancel(userId: string, id: string) {
    const booking = await this.model.findOneAndUpdate(
      { _id: id, user: userId, status: BookingStatus.Confirmed },
      { status: BookingStatus.Cancelled },
      { new: true },
    );
    if (!booking) throw new NotFoundException('Réservation introuvable ou déjà annulée');

    await this.concerts.releaseSeats(booking.concert.toString(), booking.quantity);
    return booking;
  }

  async qrCode(userId: string, id: string) {
    const booking = await this.model.findOne({ _id: id, user: userId });
    if (!booking) throw new NotFoundException('Réservation introuvable');
    if (booking.status !== BookingStatus.Confirmed) {
      throw new BadRequestException('Cette réservation est annulée');
    }
    return QRCode.toBuffer(this.link(booking.reference), {
      type: 'png',
      width: 300,
      margin: 2,
    });
  }

  // Route publique ouverte par le QR code : infos minimales, aucune donnée personnelle
  async verify(reference: string) {
    const booking = await this.model
      .findOne({ reference })
      .populate('concert', 'title band date venue');
    if (!booking) throw new NotFoundException('Réservation introuvable');

    return {
      reference: booking.reference,
      status: booking.status,
      quantity: booking.quantity,
      totalPrice: booking.totalPrice,
      concert: booking.concert,
    };
  }

  async stats(days = 30) {
    const confirmed = { status: BookingStatus.Confirmed };

    // Début de la période, à minuit UTC
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const [totals, byStatus, topConcerts, byGenre, perDay] = await Promise.all([
      // Totaux globaux (réservations confirmées)
      this.model.aggregate([
        { $match: confirmed },
        { $group: { _id: null, tickets: { $sum: '$quantity' }, revenue: { $sum: '$totalPrice' } } },
      ]),

      // Répartition par statut
      this.model.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),

      // Top 5 des concerts, avec taux de remplissage
      this.model.aggregate([
        { $match: confirmed },
        {
          $group: {
            _id: '$concert',
            bookings: { $sum: 1 },
            tickets: { $sum: '$quantity' },
            revenue: { $sum: '$totalPrice' },
          },
        },
        { $sort: { tickets: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'concerts', localField: '_id', foreignField: '_id', as: 'concert' } },
        { $unwind: '$concert' },
        {
          $project: {
            _id: 0,
            concertId: '$_id',
            title: '$concert.title',
            band: '$concert.band',
            date: '$concert.date',
            bookings: 1,
            tickets: 1,
            revenue: 1,
            fillRate: {
              $round: [{ $multiply: [{ $divide: ['$tickets', '$concert.totalSeats'] }, 100] }, 1],
            },
          },
        },
      ]),

      // Billets et revenus par genre
      this.model.aggregate([
        { $match: confirmed },
        { $lookup: { from: 'concerts', localField: 'concert', foreignField: '_id', as: 'concert' } },
        { $unwind: '$concert' },
        {
          $group: {
            _id: '$concert.genre',
            tickets: { $sum: '$quantity' },
            revenue: { $sum: '$totalPrice' },
          },
        },
        { $sort: { tickets: -1 } },
        { $project: { _id: 0, genre: '$_id', tickets: 1, revenue: 1 } },
      ]),

      // Activité par jour
      this.model.aggregate([
        { $match: { ...confirmed, createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            bookings: { $sum: 1 },
            tickets: { $sum: '$quantity' },
            revenue: { $sum: '$totalPrice' },
          },
        },
        { $project: { _id: 0, date: '$_id', bookings: 1, tickets: 1, revenue: 1 } },
      ]),
    ]);

    const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
    const confirmedBookings: number = counts[BookingStatus.Confirmed] ?? 0;
    const cancelledBookings: number = counts[BookingStatus.Cancelled] ?? 0;
    const allBookings = confirmedBookings + cancelledBookings;

    // On complète les jours sans réservation avec des zéros
    const byDate = new Map(perDay.map((d) => [d.date, d]));
    const daily = Array.from({ length: days }, (_, i) => {
      const date = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      return byDate.get(date) ?? { date, bookings: 0, tickets: 0, revenue: 0 };
    });

    return {
      summary: {
        confirmedBookings,
        cancelledBookings,
        cancellationRate: allBookings
          ? Math.round((cancelledBookings / allBookings) * 1000) / 10
          : 0,
        ticketsSold: totals[0]?.tickets ?? 0,
        revenue: totals[0]?.revenue ?? 0,
      },
      topConcerts,
      byGenre,
      daily,
    };
  }
}
