import { Injectable, NotFoundException } from '@nestjs/common';
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

  // get all users (admin only, password/refreshToken excluded by schema `select: false`)
  getUsers() {
    return this.userModel.find().exec();
  }

  // get user by id
  async getUsersById(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // get user by email (includes password hash, needed for login)
  findByEmail(email: string) {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  // get user by id including refresh token hash (needed for refresh-token rotation)
  getUsersByIdWithRefreshToken(id: string) {
    return this.userModel.findById(id).select('+password +refreshToken').exec();
  }

  // update user
  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { returnDocument: 'after' })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // soft state change used by AuthService after login/refresh/logout
  async setRefreshToken(id: string, hashedRefreshToken: string | null) {
    await this.userModel
      .findByIdAndUpdate(id, { refreshToken: hashedRefreshToken })
      .exec();
  }

  // delete user (admin only)
  async deleteUser(id: string) {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return { message: 'User deleted successfully' };
  }
}
