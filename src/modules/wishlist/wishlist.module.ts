import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Wishlist, WishlistSchema } from './schema/wishlist.schema';
import {
  WishlistItem,
  WishlistItemSchema,
} from './schema/wishlist-item.schema';
import { WishlistService } from './wishlist.service';
import { WishlistController } from './wishlist.controller';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wishlist.name, schema: WishlistSchema },
      { name: WishlistItem.name, schema: WishlistItemSchema },
    ]),
    ProductModule,
  ],
  controllers: [WishlistController],
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}
