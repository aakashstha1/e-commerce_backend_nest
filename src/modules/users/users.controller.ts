import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UserRole } from './enums/user-role-enum';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Get all users - admin only
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  getUsers() {
    return this.usersService.getUsers();
  }

  // Get my own profile
  @Get('me')
  getMe(@CurrentUser('userId') userId: string) {
    return this.usersService.getUsersById(userId);
  }

  // Update my own profile
  @Patch('me')
  updateMe(
    @CurrentUser('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(userId, updateUserDto);
  }

  // Get user by id - admin only
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  getUserById(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.getUsersById(id);
  }

  // Update user by id - admin only
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  // Delete user - admin only
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.deleteUser(id);
  }
}
