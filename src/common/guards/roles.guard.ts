import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from 'src/modules/users/enums/user-role-enum';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Enforces role-based access control. Combine with @Roles(...) decorator.
 * Must run after JwtAuthGuard (relies on request.user being populated).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user?.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}
