import { Module } from '@nestjs/common';
import { WeappAddressController } from './address.controller';
import { AddressService } from './address.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappAddressController],
  providers: [AddressService],
  exports: [AddressService],
})
export class AddressModule {}
