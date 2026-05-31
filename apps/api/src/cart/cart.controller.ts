import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CartService } from './cart.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AddCartDto } from './dto/add-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';

@Controller('weapp/cart')
export class WeappCartController {
  constructor(private readonly cartService: CartService) {}

  @Get('list')
  async list(@CurrentUser('id') userId: string) {
    return this.cartService.findAll(userId);
  }

  @Post('add')
  async add(@CurrentUser('id') userId: string, @Body() dto: AddCartDto) {
    return this.cartService.addItem(userId, dto);
  }

  @Put('update')
  async update(@CurrentUser('id') userId: string, @Body() dto: UpdateCartDto) {
    return this.cartService.updateItem(userId, dto);
  }

  @Delete('delete/:id')
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.cartService.removeItem(userId, id);
  }

  @Put('select-all')
  async selectAll(
    @CurrentUser('id') userId: string,
    @Body() body: { isSelected: number },
  ) {
    return this.cartService.selectAll(userId, body.isSelected);
  }

  @Delete('remove-selected')
  async removeSelected(@CurrentUser('id') userId: string) {
    return this.cartService.removeSelected(userId);
  }
}
