import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'src/modules/users/enums/user-role-enum';

export const ROLES_KEY = 'roles';
/**
 * Attach to a controller or route handler to restrict access to specific roles.
 * Usage: @Roles(UserRole.ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
