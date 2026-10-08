const { Injectable, Inject, ForbiddenException, UnauthorizedException } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { ROLES_KEY } = require('../decorators/roles.decorator');

/**
 * Registered globally: routes decorated with `@Roles('admin')` reject any other role with 403.
 */
@Injectable()
class RolesGuard {
  @Inject(Reflector)
  reflector;

  canActivate(context) {
    const requiredRoles = this.reflector.getAllAndOverride(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new UnauthorizedException('Authentication token is missing');
    if (!requiredRoles.includes(user.role)) throw new ForbiddenException('This action is unauthorized');

    return true;
  }
}

module.exports = { RolesGuard };
