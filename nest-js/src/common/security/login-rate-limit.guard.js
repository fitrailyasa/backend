const { HttpException, HttpStatus, Inject, Injectable } = require('@nestjs/common');
const { LoginRateLimitService, LOGIN_LOCKED_MESSAGE } = require('./login-rate-limit.service');
const { normalizeEmail } = require('./login-rate-limit.store');

/**
 * Guards `POST /api/v1/auth/login` only. It runs before the validation pipe
 * and the controller, so a locked account or IP is rejected with 429 +
 * `Retry-After` without ever touching the password hash.
 */
@Injectable()
class LoginRateLimitGuard {
  @Inject(LoginRateLimitService)
  loginRateLimit;

  canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const email = normalizeEmail(request.body?.email);
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';

    const { locked, retryAfterSeconds } = this.loginRateLimit.check(email, ip);
    if (!locked) return true;

    // Nest 11 exceptions cannot carry response headers, so `Retry-After` is
    // written on the response before the 429 is thrown.
    const response = context.switchToHttp().getResponse();
    if (typeof response?.set === 'function') {
      response.set('Retry-After', String(retryAfterSeconds));
    }

    throw new HttpException(
      { success: false, message: LOGIN_LOCKED_MESSAGE },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

module.exports = { LoginRateLimitGuard };
