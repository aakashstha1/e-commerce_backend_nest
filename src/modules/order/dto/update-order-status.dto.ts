import { IsEnum } from 'class-validator';
import { OrderStatus } from '../schema/order.schema';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
