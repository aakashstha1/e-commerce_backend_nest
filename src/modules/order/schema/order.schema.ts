import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: { createdAt: false, updatedAt: true } })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Address', required: true })
  addressId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  orderNumber!: string;

  @Prop({ required: true, min: 0 })
  subTotal!: number;

  @Prop({ required: true, min: 0, default: 0 })
  discount!: number;

  @Prop({ required: true, min: 0, default: 0 })
  shippingFee!: number;

  @Prop({ required: true, min: 0, default: 0 })
  tax!: number;

  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({ enum: OrderStatus, default: OrderStatus.PENDING, index: true })
  status!: OrderStatus;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.PENDING, index: true })
  paymentStatus!: PaymentStatus;

  @Prop({ default: () => new Date() })
  placedAt!: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
