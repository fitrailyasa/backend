import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global guard. Every route requires a valid `Authorization: Bearer <token>`
 * unless it is marked with `@Public()`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown): TUser {
    if (user) return user;
    if (err instanceof UnauthorizedException) throw err;

    const detail = info as { name?: string; message?: string } | undefined;
    if (!detail || detail.message === 'No auth token') {
      throw new UnauthorizedException('Authentication token is missing');
    }
    if (detail.name === 'TokenExpiredError') {
      throw new UnauthorizedException('Token has expired');
    }

    throw new UnauthorizedException('Token is invalid');
  }
}
