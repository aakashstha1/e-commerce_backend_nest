import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/schemas/user.schema';
import { Model } from 'mongoose';
// import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // create User
  // createUser(createUserDto: CreateUserDto) {
  //   const user = new this.userModel(createUserDto);
  //   return user.save();
  // }

  // get all users
  getUsers() {
    return this.userModel.find().exec();
  }

  // get user by id
  getUsersById(id: string) {
    return this.userModel.findById(id).exec();
  }

  // update user
  updateUser(id: string, updateUserDto: UpdateUserDto) {
    return this.userModel
      .findByIdAndUpdate(id, updateUserDto, { returnDocument: 'after' })
      .exec();
  }
}
