import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class TicketTier {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 1 })
  totalSeats: number;

  @Prop({ required: true, min: 0 })
  availableSeats: number;
}

export const TicketTierSchema = SchemaFactory.createForClass(TicketTier);

export type ConcertDocument = HydratedDocument<Concert>;

@Schema({ timestamps: true })
export class Concert {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true, index: true })
  band: string;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  genre: string;

  @Prop({ required: true, index: true })
  date: Date;

  @Prop({ required: true, trim: true })
  venue: string;

  @Prop({ type: [TicketTierSchema], default: [] })
  tiers: TicketTier[];

  @Prop({ required: true, min: 1 })
  totalSeats: number;

  @Prop({ required: true, min: 0 })
  availableSeats: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop() posterUrl?: string;
  @Prop() posterPublicId?: string;
}

export const ConcertSchema = SchemaFactory.createForClass(Concert);