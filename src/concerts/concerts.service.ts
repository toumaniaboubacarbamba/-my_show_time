import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';
import { escapeRegex } from '../common/utils/escape-regex';
import { Concert, ConcertDocument } from './concert.schema';
import { CreateConcertDto } from './dto/create-concert.dto';
import { QueryConcertDto } from './dto/query-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CONCERT_CREATED, ConcertCreatedEvent } from './events/concert-created.event';
import { CONCERT_DELETED, type ConcertDeletedEvent } from './events/concert-deleted.event';

@Injectable()
export class ConcertsService {
  private readonly logger = new Logger(ConcertsService.name);

  constructor(
    @InjectModel(Concert.name) private model: Model<ConcertDocument>,
    private events: EventEmitter2,
  ) {}

  async create(dto: CreateConcertDto) {
    const concert = await this.model.create({ ...dto, availableSeats: dto.totalSeats });

    const payload: ConcertCreatedEvent = {
      id: concert.id,
      title: concert.title,
      band: concert.band,
      date: concert.date,
      venue: concert.venue,
    };
    this.events.emit(CONCERT_CREATED, payload);

    return concert;
  }

  async findAll(q: QueryConcertDto) {
    const filter: QueryFilter<ConcertDocument> = {};

    if (q.genre) filter.genre = q.genre.trim().toLowerCase();
    if (q.band) filter.band = new RegExp(escapeRegex(q.band), 'i');
    if (q.search) {
      const r = new RegExp(escapeRegex(q.search), 'i');
      filter.$or = [{ title: r }, { band: r }, { venue: r }];
    }

    let from = q.from;
    let to = q.to;
    if (q.date) {
      from = new Date(q.date);
      from.setUTCHours(0, 0, 0, 0);
      to = new Date(from);
      to.setUTCHours(23, 59, 59, 999);
    }
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ date: 1 }).skip((page - 1) * limit).limit(limit),
      this.model.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const concert = await this.model.findById(id);
    if (!concert) throw new NotFoundException('Concert introuvable');
    return concert;
  }

  async reserveSeats(id: string, quantity: number) {
    const updated = await this.model.findOneAndUpdate(
      { _id: id, date: { $gt: new Date() }, availableSeats: { $gte: quantity } },
      { $inc: { availableSeats: -quantity } },
      { returnDocument: 'after' },
    );
    if (updated) return updated;

    const concert = await this.findOne(id);
    if (concert.date <= new Date()) {
      throw new BadRequestException('Ce concert est déjà passé');
    }
    throw new ConflictException('Plus assez de places disponibles');
  }

  releaseSeats(id: string, quantity: number) {
    return this.model.updateOne({ _id: id }, { $inc: { availableSeats: quantity } });
  }

  async update(id: string, dto: UpdateConcertDto) {
    const concert = await this.findOne(id);

    if (dto.totalSeats !== undefined) {
      const available = concert.availableSeats + (dto.totalSeats - concert.totalSeats);
      if (available < 0) {
        throw new BadRequestException('Capacité inférieure au nombre de places déjà réservées');
      }
      concert.availableSeats = available;
    }

    Object.assign(concert, dto);
    return concert.save();
  }

  async remove(id: string) {
    const res = await this.model.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Concert introuvable');

    const payload: ConcertDeletedEvent = { id };
    this.logger.log(`Concert ${id} supprimé, émission de ${CONCERT_DELETED}`);
    this.events.emit(CONCERT_DELETED, payload);
  }
  
}