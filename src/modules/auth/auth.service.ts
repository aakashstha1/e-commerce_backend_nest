import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { TokensDto } from './dto/tokens.dto';
import { SignOptions } from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getPepper(): string {
    const pepper = this.configService.get<string>('security.pepper');
    if (!pepper) throw new Error('PASSWORD_PEPPER is not defined');
    return pepper;
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password + this.getPepper(), 10);
  }

  private async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password + this.getPepper(), hash);
  }

  /** Signs a short-lived access token + long-lived refresh token pair. */
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<TokensDto> {
    const payload = { sub: userId, email, role };

    const accessSecret =
      this.configService.getOrThrow<string>('jwt.accessSecret');
    const refreshSecret =
      this.configService.getOrThrow<string>('jwt.refreshSecret');

    const accessExpiresIn = this.configService.getOrThrow<
      SignOptions['expiresIn']
    >('jwt.accessExpiresIn');

    const refreshExpiresIn = this.configService.getOrThrow<
      SignOptions['expiresIn']
    >('jwt.refreshExpiresIn');

    const [accessToken, refreshToken]: [string, string] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /** Persists a bcrypt hash of the refresh token so stolen JWTs alone can't be reused after logout/rotation. */
  private async persistRefreshToken(userId: string, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.usersService.setRefreshToken(userId, hashed);
  }

  /** Removes fields that must never leave the service layer in an API response. */
  private stripSensitiveFields<T extends object>(
    user: T,
  ): Omit<T, 'password' | 'refreshToken'> {
    const clone = { ...user } as Record<string, unknown>;
    delete clone.password;
    delete clone.refreshToken;
    return clone as Omit<T, 'password' | 'refreshToken'>;
  }

  // ----------------------------------- Register -------------------------------------------------
  async signUp(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await this.hashPassword(registerDto.password);

    const user = await this.usersService.createUser({
      ...registerDto,
      password: hashedPassword,
    });

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );
    await this.persistRefreshToken(user._id.toString(), tokens.refreshToken);

    const safeUser = this.stripSensitiveFields(user.toObject());
    return { user: safeUser, ...tokens };
  }

  // ----------------------------------- Login -------------------------------------------------
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.usersService.findByEmail(email);

    if (!user || !(await this.comparePassword(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );
    await this.persistRefreshToken(user._id.toString(), tokens.refreshToken);

    const safeUser = this.stripSensitiveFields(user.toObject());
    return { user: safeUser, ...tokens };
  }

  // ----------------------------------- Refresh -------------------------------------------------
  /** Rotates tokens: the presented refresh token is invalidated and a brand new pair is issued. */
  async refreshTokens(userId: string, presentedRefreshToken: string) {
    const user = await this.usersService.getUsersByIdWithRefreshToken(userId);

    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Access denied');
    }

    const matches = await bcrypt.compare(
      presentedRefreshToken,
      user.refreshToken,
    );
    if (!matches) {
      // Possible token theft/reuse: invalidate the stored token defensively.
      await this.usersService.setRefreshToken(userId, null);
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );
    await this.persistRefreshToken(user._id.toString(), tokens.refreshToken);

    return tokens;
  }

  // ----------------------------------- Logout -------------------------------------------------
  async logout(userId: string) {
    await this.usersService.setRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }
}
