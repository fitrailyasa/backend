import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../common/decorators/roles.decorator';
import { LoginRateLimitService } from '../common/security/login-rate-limit.service';
import { normalizeEmail } from '../common/security/login-rate-limit.store';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../common/utils/password';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export const DEFAULT_EXPIRES_IN = 3600;
export const DEFAULT_REFRESH_EXPIRES_IN = 604800;
export const ACCESS_AUDIENCE = 'access';
export const REFRESH_AUDIENCE = 'refresh';

/** Row of the `users` table, read through the DataSource to keep modules decoupled. */
export type AuthUserRecord = {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
};

/** User shape that is safe to return, the hash never leaves the service. */
export type PublicUser = Omit<AuthUserRecord, 'password'>;

export interface JwtPayload {
  sub: number | string;
  email: string;
  role: UserRole;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  user: PublicUser;
  token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

@Injectable()
export class AuthService {
  private readonly revokedTokens = new Map<string, number>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly loginRateLimit: LoginRateLimitService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    if (dto.password !== dto.password_confirmation) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        errors: { password_confirmation: ['password_confirmation must match password.'] },
      });
    }

    if (await this.findByEmail(dto.email, false)) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        errors: { email: ['The email has already been taken.'] },
      });
    }

    const user = await this.users.save(
      this.users.create({
        name: dto.name,
        email: dto.email,
        password: await hashPassword(dto.password),
        role: 'user',
      }),
    );

    return this.issueTokens(user);
  }

  async login(dto: LoginDto, request?: Request): Promise<AuthTokens> {
    const email = normalizeEmail(dto.email);
    const ip = request?.ip ?? 'unknown';

    const user = await this.findByEmail(email, true);
    const matches = user
      ? await verifyPassword(dto.password, user.password)
      : // unknown email: still spend a bcrypt comparison so the timing does not
        // reveal whether the account exists
        await verifyPassword(dto.password, DUMMY_PASSWORD_HASH);

    if (!user || !matches) {
      this.loginRateLimit.recordFailure(email, ip);
      // one generic message for "wrong email" and "wrong password" alike
      throw new UnauthorizedException('These credentials do not match our records');
    }

    this.loginRateLimit.reset(email, ip);

    return this.issueTokens(user);
  }

  async refresh(token: string): Promise<AuthTokens> {
    const payload = await this.verifyRefreshToken(token);

    this.assertNotRevoked(payload);
    this.revoke(payload);

    const user = await this.findAuthUser(Number(payload.sub));

    if (!user) {
      throw new UnauthorizedException('The token is no longer valid.');
    }

    return this.issueTokens(user);
  }

  async logout(jti: string, exp: number): Promise<null> {
    this.revokedTokens.set(jti, exp > 0 ? exp : Math.floor(Date.now() / 1000));

    return null;
  }

  async me(id: number): Promise<PublicUser> {
    const user = await this.findAuthUser(id);

    if (!user) {
      throw new UnauthorizedException('The token is no longer valid.');
    }

    return user;
  }

  async findAuthUser(id: number): Promise<PublicUser | null> {
    const user = await this.users.findOne({ where: { id } });

    return user ? this.toPublicUser(user) : null;
  }

  isRevoked(payload: JwtPayload): boolean {
    const expiresAt = this.revokedTokens.get(payload.jti);

    if (expiresAt === undefined) {
      return false;
    }

    if (expiresAt * 1000 <= Date.now()) {
      this.revokedTokens.delete(payload.jti);

      return false;
    }

    return true;
  }

  private get users(): Repository<AuthUserRecord> {
    return this.dataSource.getRepository<AuthUserRecord>('users');
  }

  private async issueTokens(user: AuthUserRecord | PublicUser): Promise<AuthTokens> {
    const publicUser = 'password' in user ? this.toPublicUser(user) : user;
    return { user: publicUser, ...(await this.sign(publicUser)) };
  }

  private async sign(user: Pick<PublicUser, 'id' | 'email' | 'role'>): Promise<Omit<AuthTokens, 'user'>> {
    const payload = { sub: Number(user.id), email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn,
        audience: ACCESS_AUDIENCE,
        jwtid: randomUUID(),
      }),
      this.jwt.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn,
        audience: REFRESH_AUDIENCE,
        jwtid: randomUUID(),
      }),
    ]);

    return {
      token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.accessExpiresIn,
    };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.refreshSecret,
        audience: REFRESH_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('The refresh token is invalid or has expired.');
    }
  }

  private revoke(payload: JwtPayload): void {
    this.revokedTokens.set(payload.jti, payload.exp ?? Math.floor(Date.now() / 1000));
  }

  private assertNotRevoked(payload: JwtPayload): void {
    if (this.isRevoked(payload)) {
      throw new UnauthorizedException('The token has been revoked.');
    }
  }

  private async findByEmail(email: string, withPassword: boolean): Promise<AuthUserRecord | null> {
    const qb = this.users.createQueryBuilder('user').where('user.email = :email', { email });

    if (withPassword) {
      qb.addSelect('user.password');
    }

    return qb.getOne();
  }

  private toPublicUser(user: AuthUserRecord & { createdAt?: Date; updatedAt?: Date }): PublicUser {
    return {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at ?? user.createdAt ?? null,
      updated_at: user.updated_at ?? user.updatedAt ?? null,
    };
  }

  private get accessSecret(): string {
    return this.config.get<string>('JWT_SECRET') ?? 'change-me-super-secret-access-token';
  }

  private get refreshSecret(): string {
    return this.config.get<string>('JWT_REFRESH_SECRET') ?? `${this.accessSecret}-refresh`;
  }

  private get accessExpiresIn(): number {
    return this.toSeconds(this.config.get<string | number>('JWT_EXPIRES_IN'), DEFAULT_EXPIRES_IN);
  }

  private get refreshExpiresIn(): number {
    return this.toSeconds(
      this.config.get<string | number>('JWT_REFRESH_EXPIRES_IN'),
      DEFAULT_REFRESH_EXPIRES_IN,
    );
  }

  private toSeconds(value: string | number | undefined, fallback: number): number {
    const seconds = Number(value);

    return Number.isFinite(seconds) && seconds > 0 ? seconds : fallback;
  }
}
