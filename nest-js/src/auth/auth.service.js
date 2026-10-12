const { Injectable, Inject, UnauthorizedException, UnprocessableEntityException } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { InjectRepository } = require('@nestjs/typeorm');
const { ConfigService } = require('@nestjs/config');
const { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } = require('../common/utils/password');
const { LoginRateLimitService } = require('../common/security/login-rate-limit.service');
const { normalizeEmail } = require('../common/security/login-rate-limit.store');
const { randomUUID } = require('crypto');
const { User } = require('../users/entities/user.entity');
const { ok } = require('../common/utils/api-response');

const ACCESS_TOKEN = 'access';
const REFRESH_TOKEN = 'refresh';

@Injectable()
class AuthService {
  @InjectRepository(User)
  userRepository;

  @Inject(JwtService)
  jwtService;

  @Inject(ConfigService)
  config;

  @Inject(LoginRateLimitService)
  loginRateLimit;

  /**
   * In-memory JWT blacklist: `jti` -> expiry epoch seconds. A shared store such as
   * Redis is required when the API runs on more than one instance.
   */
  blacklistedTokens = new Map();

  saltRounds() {
    return Number(this.config.get('BCRYPT_SALT_ROUNDS', 10));
  }

  expiresIn() {
    return Number(this.config.get('JWT_EXPIRES_IN', 3600));
  }

  refreshExpiresIn() {
    return Number(this.config.get('JWT_REFRESH_EXPIRES_IN', 604800));
  }

  sanitize(user) {
    if (!user) return user;

    return {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.createdAt ?? user.created_at,
      updated_at: user.updatedAt ?? user.updated_at,
    };
  }

  async hashPassword(password) {
    return hashPassword(password, this.saltRounds());
  }

  async findById(id, withPassword = false) {
    const query = this.userRepository.createQueryBuilder('user').where('user.id = :id', { id });

    if (withPassword) query.addSelect('user.password');

    return query.getOne();
  }

  async findByEmail(email, withPassword = false) {
    const query = this.userRepository.createQueryBuilder('user').where('user.email = :email', {
      email,
    });

    if (withPassword) query.addSelect('user.password');

    return query.getOne();
  }

  async issueTokens(user, currentJti) {
    const accessToken = await this.jwtService.signAsync(
      { sub: String(user.id), email: user.email, role: user.role, type: ACCESS_TOKEN, jti: randomUUID() },
      { expiresIn: this.expiresIn() },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: String(user.id), type: REFRESH_TOKEN, jti: randomUUID() },
      { expiresIn: this.refreshExpiresIn() },
    );

    if (currentJti) this.blacklist(currentJti);

    return {
      token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.expiresIn(),
    };
  }

  blacklist(jti, expiresAt) {
    if (!jti) return;

    const expiry = Number(expiresAt) || Math.floor(Date.now() / 1000) + this.expiresIn();
    this.blacklistedTokens.set(jti, expiry);
    this.pruneBlacklist();
  }

  pruneBlacklist() {
    const now = Math.floor(Date.now() / 1000);

    for (const [jti, expiry] of this.blacklistedTokens.entries()) {
      if (expiry <= now) this.blacklistedTokens.delete(jti);
    }
  }

  isBlacklisted(jti) {
    this.pruneBlacklist();
    return this.blacklistedTokens.has(jti);
  }

  async register(payload) {
    const email = payload.email.toLowerCase();
    const existing = await this.findByEmail(email);

    if (existing) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        errors: { email: ['The email has already been taken.'] },
      });
    }

    const user = this.userRepository.create({
      name: payload.name,
      email,
      password: await this.hashPassword(payload.password),
      role: 'user',
    });

    const saved = await this.userRepository.save(user);

    return ok(
      { user: this.sanitize(saved), ...(await this.issueTokens(saved)) },
      'User registered successfully',
    );
  }

  async login(payload, request = {}) {
    const email = normalizeEmail(payload.email);
    const ip = request.ip ?? 'unknown';

    const user = await this.findByEmail(email, true);
    const matches = user
      ? await verifyPassword(payload.password, user.password)
      : // unknown email: still spend a bcrypt comparison so the timing does not
        // reveal whether the account exists
        await verifyPassword(payload.password, DUMMY_PASSWORD_HASH);

    if (!user || !matches) {
      this.loginRateLimit.recordFailure(email, ip);
      // one generic message for "wrong email" and "wrong password" alike
      throw new UnauthorizedException('These credentials do not match our records');
    }

    this.loginRateLimit.reset(email, ip);

    return ok({ ...(await this.issueTokens(user)), user: this.sanitize(user) }, 'Login successful');
  }

  async refreshFromRequest(request) {
    const [scheme, token] = String(request.headers.authorization ?? '').split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('A refresh token is required.');
    }

    return this.refresh(token);
  }

  async refresh(token) {
    let payload;

    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (payload.type !== REFRESH_TOKEN || this.isBlacklisted(payload.jti)) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const user = await this.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Invalid or expired refresh token.');

    return { ...(await this.issueTokens(user, payload.jti)), user: this.sanitize(user) };
  }

  async logout(user) {
    this.blacklist(user.jti, user.exp);
    return ok(null, 'Logged out successfully');
  }

  async me(userId) {
    const user = await this.findById(userId);
    return ok(this.sanitize(user), 'Authenticated user retrieved');
  }
}

module.exports = { AuthService };
