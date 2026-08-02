import { IsMongoId } from 'class-validator';

export class AddWishlistItemDto {
  @IsMongoId()
  productId!: string;
}
