import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService], // Permitimos que AuthModule consuma este servicio
})
export class UsersModule {}
