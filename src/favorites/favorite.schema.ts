import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../users/user.schema';

export type FavoriteDocument = HydratedDocument<Favorite>;

@Schema({ timestamps: true })
export class Favorite {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId;

  @Prop({ required: true, trim: true })
  band: string; // nom tel que saisi

  @Prop({ required: true, index: true })
  bandKey: string; // version normalisée, utilisée pour la comparaison
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);
FavoriteSchema.index({ user: 1, bandKey: 1 }, { unique: true });