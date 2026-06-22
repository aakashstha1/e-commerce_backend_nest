import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole } from '../enums/user-role-enum';

export type UserDocument = HydratedDocument<User>;
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, select: false })
  password!: string;

  @Prop({ required: false, unique: true })
  phone?: string;

  @Prop({ enum: UserRole, default: UserRole.USER })
  role!: string;

  @Prop({ required: false })
  avatarUrl?: string;

  @Prop({ default: false })
  isVerified!: boolean;

  @Prop({ default: null })
  refreshToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User); //converts a TypeScript class (User) into a Mongoose schema.
