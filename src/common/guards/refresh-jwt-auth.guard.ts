import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Used solely on POST /auth/refresh. Validates the refresh token
 * (sent in the Authorization header) via JwtRefreshStrategy.
 */
@Injectable()
export class RefreshJwtAuthGuard extends AuthGuard('jwt-refresh') {}
