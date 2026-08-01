import { IsInt } from 'class-validator';

export class AdjustStockDto {
  /** Positive to add stock, negative to deduct. */
  @IsInt()
  quantity!: number;
}
