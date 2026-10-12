import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LOGIN_LOCKED_MESSAGE, LoginRateLimitService } from './login-rate-limit.service';
import { normalizeEmail } from './login-rate-limit.store';

/**
 * Guards `POST /api/v1/auth/login` only. It runs before the validation pipe
 * and the controller, so a locked account or IP is rejected with 429 +
 * `Retry-After` without ever touching the password hash.
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly loginRateLimit: LoginRateLimitService) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const body = request.body as { email?: unknown } | undefined;
    const email = normalizeEmail(body?.email);
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';

    const { locked, retryAfterSeconds } = this.loginRateLimit.check(email, ip);
    if (!locked) return true;

    // Nest 11 exceptions cannot carry response headers, so `Retry-After` is
    // written on the response before the 429 is thrown.
    http.getResponse<Response>().set('Retry-After', String(retryAfterSeconds));

    throw new HttpException(
      { success: false, message: LOGIN_LOCKED_MESSAGE },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
