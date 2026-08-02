import { IsMongoId, IsOptional, IsString } from 'class-validator';

/**
 * Represents the payload a payment gateway webhook/callback would send.
 * In production, this is replaced by verified webhook handlers per gateway
 * (Stripe signature verification, eSewa/Khalti server-to-server verification calls).
 */
export class ConfirmPaymentDto {
  @IsMongoId()
  paymentId!: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}
