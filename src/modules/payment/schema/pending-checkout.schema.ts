import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum PendingCheckoutStatus {
  PENDING = 'pending',
  CONSUMED = 'consumed',
  FAILED = 'failed',
}

export type PendingCheckoutDocument = HydratedDocument<PendingCheckout>;

/**
 * Holds a checkout "intent" for online payments (eSewa etc.) between the moment
 * the user is redirected to the payment gateway and the moment payment is
 * confirmed. No Order/stock-decrement exists yet at this point — that only
 * happens once eSewa confirms the payment succeeded, per the "place order only
 * after payment is done" requirement for online methods.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: true } })
export class PendingCheckout {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Address', required: true })
  addressId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, unique: true, index: true })
  transactionUuid!: string;

  @Prop({ enum: PendingCheckoutStatus, default: PendingCheckoutStatus.PENDING })
  status!: PendingCheckoutStatus;

  @Prop({ type: Types.ObjectId, ref: 'Order', default: null })
  orderId?: Types.ObjectId | null;
}

export const PendingCheckoutSchema =
  SchemaFactory.createForClass(PendingCheckout);
