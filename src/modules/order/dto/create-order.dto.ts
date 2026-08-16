import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { OrderPaymentMethod } from '../schema/order.schema';

export class CreateOrderDto {
  @IsMongoId()
  addressId!: string;

  /** Optional coupon/promo code applied at checkout. */
  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsEnum(OrderPaymentMethod)
  paymentMethod?: OrderPaymentMethod;
}
