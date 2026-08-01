import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductImageDocument = HydratedDocument<ProductImage>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ProductImage {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  imageUrl!: string;

  @Prop({ default: 0 })
  sortOrder!: number;
}

export const ProductImageSchema = SchemaFactory.createForClass(ProductImage);
