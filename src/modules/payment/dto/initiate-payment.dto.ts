import { IsEnum, IsMongoId } from 'class-validator';
import { PaymentMethod } from '../schema/payment.schema';

export class InitiatePaymentDto {
  @IsMongoId()
  orderId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
