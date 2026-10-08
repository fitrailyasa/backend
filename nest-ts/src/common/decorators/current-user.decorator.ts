import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from './roles.decorator';

/** Shape produced by the JWT strategy and attached to every authenticated request. */
export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  jti: string;
  exp: number;
}

/**
 * Injects the authenticated user: `@CurrentUser()` for the whole object or
 * `@CurrentUser('id')` for a single field.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return field ? user[field] : user;
  },
);
