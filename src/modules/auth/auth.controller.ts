import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UseGuards } from '@nestjs/common';
import { RefreshJwtAuthGuard } from 'src/common/guards/refresh-jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  signUp(@Body() registerDto: RegisterDto) {
    return this.authService.signUp(registerDto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // Client sends the refresh token as: Authorization: Bearer <refreshToken>
  @Public()
  @UseGuards(RefreshJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(
    @CurrentUser('userId') userId: string,
    @CurrentUser('refreshToken') refreshToken: string,
  ) {
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@CurrentUser('userId') userId: string) {
    return this.authService.logout(userId);
  }
}
