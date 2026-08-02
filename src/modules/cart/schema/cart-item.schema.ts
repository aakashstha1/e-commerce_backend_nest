import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CartItemDocument = HydratedDocument<CartItem>;

@Schema({ timestamps: true })
export class CartItem {
  @Prop({ type: Types.ObjectId, ref: 'Cart', required: true, index: true })
  cartId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  /** Price captured at the moment the item was added, so cart totals stay stable
   *  even if the product price changes before checkout. Re-validated at checkout. */
  @Prop({ required: true, min: 0 })
  priceSnapshot!: number;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);
CartItemSchema.index({ cartId: 1, productId: 1 }, { unique: true });
