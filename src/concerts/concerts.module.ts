import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Concert, ConcertSchema } from './concert.schemas';
import { ConcertsController } from './concerts.controller';
import { ConcertsService } from './concerts.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Concert.name, schema: ConcertSchema }])],
  controllers: [ConcertsController],
  providers: [ConcertsService],
  exports: [ConcertsService], // servira pour les réservations
})
export class ConcertsModule {}