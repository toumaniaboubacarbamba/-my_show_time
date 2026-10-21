import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [UsersModule, BookingsModule],
  controllers: [AdminController],
})
export class AdminModule {}
