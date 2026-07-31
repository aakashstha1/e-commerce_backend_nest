import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Refresh Token Guard
 * Checks if the refresh token is valid.
 * Used only for the refresh endpoint.
 */
@Injectable()
export class RefreshJwtAuthGuard extends AuthGuard('jwt-refresh') {}
