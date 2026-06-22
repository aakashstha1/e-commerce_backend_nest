/* eslint-disable @typescript-eslint/no-unused-vars */
import { ConflictException, Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  // ----------------------------------- Register User -------------------------------------------------
  async signUp(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const pepper = this.configService.get<string>('security.pepper');

    if (!pepper) {
      throw new Error('PEPPER is not defined');
    }

    const hashedPassword = await bcrypt.hash(password + pepper, 10);

    const user = await this.usersService.createUser({
      ...registerDto,
      password: hashedPassword,
    });

    const { password: pw, ...rest } = user.toObject();

    return rest;
  }

  // ----------------------------------- Login User -------------------------------------------------
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const pepper = this.configService.get<string>('security.pepper');

    if (!pepper) {
      throw new Error('PEPPER is not defined');
    }

    const isPasswordMatched = await bcrypt.compare(
      password + pepper,
      user.password,
    );

    if (!isPasswordMatched) {
      throw new Error('Invalid credentials');
    }

    return user;
  }
}
