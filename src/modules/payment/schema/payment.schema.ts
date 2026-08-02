import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum PaymentMethod {
  COD = 'cod',
  STRIPE = 'stripe',
  ESEWA = 'esewa',
  KHALTI = 'khalti',
}

export enum PaymentTransactionStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ enum: PaymentMethod, required: true })
  method!: PaymentMethod;

  @Prop({ type: String, default: null })
  transactionId?: string | null;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, default: 'NPR' })
  currency!: string;

  @Prop({
    enum: PaymentTransactionStatus,
    default: PaymentTransactionStatus.PENDING,
  })
  status!: PaymentTransactionStatus;

  @Prop({ type: Date, default: null })
  paidAt?: Date | null;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
