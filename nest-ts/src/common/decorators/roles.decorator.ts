import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type UserRole = 'user' | 'admin';

/** Restricts a route (or a whole controller) to the given roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
