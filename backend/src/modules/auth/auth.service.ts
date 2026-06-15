import { Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/schemas/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class AuthService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}
  signUp(registerDto: RegisterDto) {
    const { name, email, password } = registerDto;

    const existingUser = this.userModel.findOne({ email });

    if (existingUser) {
      throw new Error('User already exists');
    }

    const user = new this.userModel({ name, email, password });
    return user.save();
  }
}
