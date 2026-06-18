import { Module, Global, forwardRef } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisSubscriberService } from './redis-subscriber.service';
import { AppointmentsModule } from '../appointments/appointments.module';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AppointmentsModule),
  ],
  providers: [RedisService, RedisSubscriberService],
  exports: [RedisService, RedisSubscriberService],
})
export class RedisModule {}
