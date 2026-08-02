import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsMongoId()
  addressId!: string;

  /** Optional coupon/promo code applied at checkout. */
  @IsOptional()
  @IsString()
  couponCode?: string;
}
