import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WishlistItemDocument = HydratedDocument<WishlistItem>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class WishlistItem {
  @Prop({ type: Types.ObjectId, ref: 'Wishlist', required: true, index: true })
  wishlistId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;
}

export const WishlistItemSchema = SchemaFactory.createForClass(WishlistItem);
WishlistItemSchema.index({ wishlistId: 1, productId: 1 }, { unique: true });
