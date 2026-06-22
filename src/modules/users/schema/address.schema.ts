import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AddressDocument = HydratedDocument<Address>;
@Schema({ timestamps: true })
export class Address {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  fullName!: string;

  @Prop({ required: true })
  country!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: true })
  state!: string;

  @Prop({ required: true })
  postalCode!: string;

  @Prop({ required: true })
  street!: string;

  @Prop({ required: true })
  isDefault!: boolean;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
