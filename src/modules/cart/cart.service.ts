import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schema/cart.schema';
import { CartItem, CartItemDocument } from './schema/cart-item.schema';
import { ProductService } from '../product/product.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(CartItem.name) private cartItemModel: Model<CartItemDocument>,
    private readonly productService: ProductService,
  ) {}

  /** Every user has exactly one cart, lazily created on first use. */
  async getOrCreateCart(userId: string) {
    let cart = await this.cartModel.findOne({ userId }).exec();
    if (!cart) cart = await this.cartModel.create({ userId });
    return cart;
  }

  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    const items = await this.cartItemModel
      .find({ cartId: cart._id })
      .populate(
        'productId',
        'name slug thumbnailUrl price discountPrice stockQuantity',
      )
      .exec();

    const subTotal = items.reduce(
      (sum, item) => sum + item.priceSnapshot * item.quantity,
      0,
    );

    return { cart, items, subTotal };
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const cart = await this.getOrCreateCart(userId);
    const product = await this.productService.findOne(dto.productId);

    if (product.stockQuantity < dto.quantity) {
      throw new BadRequestException('Not enough stock available');
    }

    const price = product.discountPrice ?? product.price;
    const existing = await this.cartItemModel.findOne({
      cartId: cart._id,
      productId: dto.productId,
    });

    if (existing) {
      existing.quantity += dto.quantity;
      existing.priceSnapshot = price;
      await existing.save();
    } else {
      await this.cartItemModel.create({
        cartId: cart._id,
        productId: dto.productId,
        quantity: dto.quantity,
        priceSnapshot: price,
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.cartItemModel.findOne({
      _id: itemId,
      cartId: cart._id,
    });
    if (!item) throw new NotFoundException('Cart item not found');

    const product = await this.productService.findOne(
      item.productId.toString(),
    );
    if (product.stockQuantity < dto.quantity) {
      throw new BadRequestException('Not enough stock available');
    }

    item.quantity = dto.quantity;
    await item.save();
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);
    const result = await this.cartItemModel.deleteOne({
      _id: itemId,
      cartId: cart._id,
    });
    if (result.deletedCount === 0)
      throw new NotFoundException('Cart item not found');
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.cartItemModel.deleteMany({ cartId: cart._id });
    return { message: 'Cart cleared' };
  }

  /** Used internally by OrderService during checkout. */
  // async getCartItemsForCheckout(cartId: string) {
  //   console.log(cartId);
  //   return this.cartItemModel.find({ cartId }).exec();
  // }
  async getCartItemsForCheckout(cartId: string) {
    return this.cartItemModel
      .find({ cartId: new Types.ObjectId(cartId) })
      .exec();
  }
}
