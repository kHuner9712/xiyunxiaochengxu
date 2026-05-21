import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { AddressService } from './address.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateAddressDto } from './dto/create-address.dto';

@Controller('weapp/address')
export class WeappAddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  async findAll(@CurrentUser('id') userId: string) {
    return this.addressService.findAll(userId);
  }

  @Get(':id')
  async findById(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.addressService.findById(userId, id);
  }

  @Post()
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateAddressDto) {
    return this.addressService.create(userId, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAddressDto>,
  ) {
    return this.addressService.update(userId, id, dto);
  }

  @Delete(':id')
  async delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.addressService.delete(userId, id);
  }

  @Put(':id/default')
  async setDefault(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.addressService.setDefault(userId, id);
  }
}
