import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser('userId') userId: string) {
    return this.cartService.getCart(userId);
  }

  @Post('items')
  addItem(@CurrentUser('userId') userId: string, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(userId, dto);
  }

  @Patch('items/:itemId')
  updateItem(
    @CurrentUser('userId') userId: string,
    @Param('itemId', ParseObjectIdPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(userId, itemId, dto);
  }

  @Delete('items/:itemId')
  removeItem(
    @CurrentUser('userId') userId: string,
    @Param('itemId', ParseObjectIdPipe) itemId: string,
  ) {
    return this.cartService.removeItem(userId, itemId);
  }

  @Delete()
  clearCart(@CurrentUser('userId') userId: string) {
    return this.cartService.clearCart(userId);
  }
}
