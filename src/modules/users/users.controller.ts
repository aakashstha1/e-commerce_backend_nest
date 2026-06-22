import { UsersService } from './users.service';
// import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Create User
  // @Post()
  // createUser(@Body() createUserDto: CreateUserDto) {
  //   return this.usersService.createUser(createUserDto);
  // }

  // Get Users
  @Get()
  getUsers() {
    return this.usersService.getUsers();
  }

  // Get User By Id
  @Get(':id')
  async getUserById(@Param('id', ParseObjectIdPipe) id: string) {
    const user = await this.usersService.getUsersById(id);

    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  // Update User
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.usersService.remove(+id);
  // }
}
