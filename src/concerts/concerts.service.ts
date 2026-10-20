import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';
import { escapeRegex } from '../common/utils/escape-regex';
import { Concert, ConcertDocument } from './concert.schemas';
import { CreateConcertDto } from './dto/create-concert.dto';
import { QueryConcertDto } from './dto/query-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CONCERT_CREATED, ConcertCreatedEvent } from './events/concert-created.event';


@Injectable()
export class ConcertsService {
  constructor(@InjectModel(Concert.name) private model: Model<ConcertDocument>,
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
    // Opération atomique : décrémente seulement s'il reste assez de places
    const updated = await this.model.findOneAndUpdate(
      { _id: id, date: { $gt: new Date() }, availableSeats: { $gte: quantity } },
      { $inc: { availableSeats: -quantity } },
      { new: true },
    );
    if (updated) return updated;

    const concert = await this.findOne(id); // 404 si le concert n'existe pas
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

    // Si la capacité change, on ajuste les places restantes sans descendre sous 0
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
  }
}