import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({ required: true, unique: true })
  phone!: string;

  @Prop({ required: true })
  address!: string;

  @Prop({ default: 'user' })
  role!: string;

  @Prop({ required: false })
  avatarUrl?: string;

  @Prop({ default: false })
  isVerified!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
