import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/modules/users/schema/user.schema';
import { Model } from 'mongoose';
import { UpdateUserDto } from './dto/update-user.dto';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // create User
  async createUser(registerDto: RegisterDto) {
    const user = new this.userModel(registerDto);
    return user.save();
  }

  // get all users
  getUsers() {
    return this.userModel.find().exec();
  }

  // get user by id
  getUsersById(id: string) {
    return this.userModel.findById(id).exec();
  }

  // get user by email
  findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  // update user
  updateUser(id: string, updateUserDto: UpdateUserDto) {
    return this.userModel
      .findByIdAndUpdate(id, updateUserDto, { returnDocument: 'after' })
      .exec();
  }
}
