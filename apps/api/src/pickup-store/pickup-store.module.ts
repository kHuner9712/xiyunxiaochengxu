import { Module } from '@nestjs/common';
import { WeappPickupStoreController, AdminPickupStoreController } from './pickup-store.controller';
import { PickupStoreService } from './pickup-store.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappPickupStoreController, AdminPickupStoreController],
  providers: [PickupStoreService],
  exports: [PickupStoreService],
})
export class PickupStoreModule {}
