import { IsMongoId } from 'class-validator';

export class InitiateEsewaDto {
  @IsMongoId()
  addressId!: string;
}
