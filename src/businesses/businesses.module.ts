import { Module } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';

@Module({
  providers: [BusinessesService],
  controllers: [BusinessesController]
})
export class BusinessesModule {}
