import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from 'src/modules/users/enums/user-role-enum';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  refreshToken?: string;
}

/**
 * Extracts the authenticated user (attached by JwtStrategy) from the request.
 * Usage: getMe(@CurrentUser() user: AuthenticatedUser)
 *        getMyId(@CurrentUser('userId') userId: string)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
