import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { HydratedDocument, Types } from 'mongoose';
import { Concert } from '../concerts/concert.schemas';
import { User } from '../users/user.schema';
import { BookingStatus } from './booking-status.enum';

export type BookingDocument = HydratedDocument<Booking>;

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Concert.name, required: true, index: true })
  concert: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  totalPrice: number;

  @Prop({ type: String, enum: BookingStatus, default: BookingStatus.Confirmed })
  status: BookingStatus;

  @Prop({ required: true, unique: true, default: () => randomUUID() })
  reference: string;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
