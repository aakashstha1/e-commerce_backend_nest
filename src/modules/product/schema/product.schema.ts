import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  slug!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  sku!: string;

  @Prop({ trim: true })
  brand?: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ type: Number, min: 0, default: null })
  discountPrice?: number | null;

  @Prop({ required: true, min: 0, default: 0 })
  stockQuantity!: number;

  @Prop()
  thumbnailUrl?: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ name: 'text', description: 'text', brand: 'text' });
