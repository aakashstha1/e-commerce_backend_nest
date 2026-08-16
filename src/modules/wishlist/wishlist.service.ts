import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wishlist, WishlistDocument } from './schema/wishlist.schema';
import {
  WishlistItem,
  WishlistItemDocument,
} from './schema/wishlist-item.schema';
import { ProductService } from '../product/product.service';

@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(Wishlist.name) private wishlistModel: Model<WishlistDocument>,
    @InjectModel(WishlistItem.name)
    private wishlistItemModel: Model<WishlistItemDocument>,
    private readonly productService: ProductService,
  ) {}

  async getOrCreateWishlist(userId: string) {
    let wishlist = await this.wishlistModel.findOne({ userId }).exec();
    if (!wishlist) wishlist = await this.wishlistModel.create({ userId });
    return wishlist;
  }

  async getWishlist(userId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);
    const items = await this.wishlistItemModel
      .find({ wishlistId: wishlist._id })
      .populate(
        'productId',
        'name slug thumbnail price discountPrice stockQuantity',
      )
      .exec();
    return { wishlist, items };
  }

  async addItem(userId: string, productId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);
    await this.productService.findOne(productId); // throws 404 if missing

    const existing = await this.wishlistItemModel.findOne({
      wishlistId: wishlist._id,
      productId,
    });
    if (existing) throw new ConflictException('Product already in wishlist');

    await this.wishlistItemModel.create({
      wishlistId: wishlist._id,
      productId,
    });
    return this.getWishlist(userId);
  }

  async removeItem(userId: string, productId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);
    const result = await this.wishlistItemModel.deleteOne({
      wishlistId: wishlist._id,
      productId,
    });
    if (result.deletedCount === 0)
      throw new NotFoundException('Item not found in wishlist');
    return this.getWishlist(userId);
  }
}
