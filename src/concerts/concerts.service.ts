import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryFilter, Model } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UploadedImageFile } from '../common/types/uploaded-image-file';
import { escapeRegex } from '../common/utils/escape-regex';
import { Concert, ConcertDocument } from './concert.schema';
import { CreateConcertDto, TicketTierDto } from './dto/create-concert.dto';
import { QueryConcertDto } from './dto/query-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { CONCERT_CREATED, ConcertCreatedEvent } from './events/concert-created.event';
import { CONCERT_DELETED, type ConcertDeletedEvent } from './events/concert-deleted.event';

@Injectable()
export class ConcertsService {
  private readonly logger = new Logger(ConcertsService.name);

  constructor(
    @InjectModel(Concert.name) private model: Model<ConcertDocument>,
    private events: EventEmitter2,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private normalizeTiers(tiers: TicketTierDto[]) {
    const seen = new Set<string>();

    return tiers.map((tier) => {
      const name = tier.name.trim();
      const key = name.toLowerCase();
      if (seen.has(key)) throw new BadRequestException(`Catégorie en double : ${name}`);
      seen.add(key);

      return {
        name,
        price: tier.price,
        totalSeats: tier.totalSeats,
      };
    });
  }

  private totals(tiers: { price: number; totalSeats: number; availableSeats: number }[]) {
    return {
      totalSeats: tiers.reduce((sum, tier) => sum + tier.totalSeats, 0),
      availableSeats: tiers.reduce((sum, tier) => sum + tier.availableSeats, 0),
      price: Math.min(...tiers.map((tier) => tier.price)),
    };
  }

  async create(dto: CreateConcertDto) {
    const { tiers: rawTiers, ...rest } = dto;
    const tiers = this.normalizeTiers(rawTiers).map((tier) => ({
      ...tier,
      availableSeats: tier.totalSeats,
    }));

    const concert = await this.model.create({
      ...rest,
      tiers,
      ...this.totals(tiers),
    });

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

  async reserveSeats(id: string, tierName: string, quantity: number) {
    const updated = await this.model.findOneAndUpdate(
      {
        _id: id,
        date: { $gt: new Date() },
        tiers: { $elemMatch: { name: tierName, availableSeats: { $gte: quantity } } },
      },
      { $inc: { 'tiers.$.availableSeats': -quantity, availableSeats: -quantity } },
      { returnDocument: 'after' },
    );

    if (updated) {
      const tier = updated.tiers.find((t) => t.name === tierName)!;
      return { concert: updated, tier };
    }

    const concert = await this.findOne(id);
    if (concert.date <= new Date()) throw new BadRequestException('Ce concert est déjà passé');
    if (!concert.tiers.some((tier) => tier.name === tierName)) {
      throw new BadRequestException('Catégorie de billet inconnue');
    }
    throw new ConflictException('Plus assez de places disponibles dans cette catégorie');
  }

  releaseSeats(id: string, tierName: string, quantity: number) {
    return this.model.updateOne(
      { _id: id, 'tiers.name': tierName },
      { $inc: { 'tiers.$.availableSeats': quantity, availableSeats: quantity } },
    );
  }

  async update(id: string, dto: UpdateConcertDto) {
    const concert = await this.findOne(id);
    const { tiers: newTiers, ...rest } = dto;
    Object.assign(concert, rest);

    if (newTiers) {
      const next = this.normalizeTiers(newTiers);
      const old = new Map(concert.tiers.map((tier) => [tier.name.toLowerCase(), tier]));

      const merged = next.map((tier) => {
        const prev = old.get(tier.name.toLowerCase());
        const sold = prev ? prev.totalSeats - prev.availableSeats : 0;

        if (tier.totalSeats < sold) {
          throw new BadRequestException(
            `« ${tier.name} » : capacité inférieure aux ${sold} places déjà réservées`,
          );
        }

        return { ...tier, availableSeats: tier.totalSeats - sold };
      });

      for (const prev of concert.tiers) {
        const kept = next.some((tier) => tier.name.toLowerCase() === prev.name.toLowerCase());
        if (!kept && prev.totalSeats - prev.availableSeats > 0) {
          throw new BadRequestException(
            `La catégorie « ${prev.name} » a déjà des réservations : elle ne peut pas être supprimée`,
          );
        }
      }

      concert.tiers = merged;
      Object.assign(concert, this.totals(merged));
    }

    return concert.save();
  }

  async remove(id: string) {
    const res = await this.model.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Concert introuvable');

    const payload: ConcertDeletedEvent = { id };
    this.logger.log(`Concert ${id} supprimé, émission de ${CONCERT_DELETED}`);
    this.events.emit(CONCERT_DELETED, payload);
  }

  async setPoster(id: string, file: UploadedImageFile) {
    const concert = await this.model.findById(id);
    if (!concert) throw new NotFoundException('Concert introuvable');

    const result = await this.cloudinary.uploadImage(file);
    concert.posterUrl = result.secure_url;
    concert.posterPublicId = result.public_id;
    return concert.save();
  }
}