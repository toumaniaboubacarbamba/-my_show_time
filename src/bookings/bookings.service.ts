import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as QRCode from 'qrcode';
import { ConcertsService } from '../concerts/concerts.service';
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
}
