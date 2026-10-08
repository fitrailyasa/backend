const { Injectable, Inject, UnauthorizedException } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { AuthGuard } = require('@nestjs/passport');
const { IS_PUBLIC_KEY } = require('../decorators/public.decorator');

/**
 * Registered globally: every route requires a valid bearer token unless it is
 * decorated with `@Public()`.
 */
@Injectable()
class JwtAuthGuard extends AuthGuard('jwt') {
  @Inject(Reflector)
  reflector;

  canActivate(context) {
    const isPublic = this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return isPublic ? true : super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (user) return user;
    if (err instanceof UnauthorizedException) throw err;
    if (!info || info.message === 'No auth token') {
      throw new UnauthorizedException('Authentication token is missing');
    }
    if (info.name === 'TokenExpiredError') {
      throw new UnauthorizedException('Token has expired');
    }
    throw new UnauthorizedException('Token is invalid');
  }
}

module.exports = { JwtAuthGuard };
