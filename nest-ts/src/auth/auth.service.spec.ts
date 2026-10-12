import { UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { LoginRateLimitService, resetLoginRateLimits } from '../common/security/login-rate-limit.service';
import { hashPassword } from '../common/utils/password';
import { AuthService, AuthUserRecord, JwtPayload } from './auth.service';

const ACCESS_SECRET = 'test-access-secret';
const REFRESH_SECRET = 'test-refresh-secret';
const EXPIRES_IN = 3600;

const row = (overrides: Partial<AuthUserRecord> = {}): AuthUserRecord => ({
  id: 1,
  name: 'Admin',
  email: 'admin@example.com',
  password: '',
  role: 'admin',
  created_at: new Date('2024-01-01T00:00:00.000Z'),
  updated_at: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

const createHarness = (user: AuthUserRecord | null = row()) => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(user),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    create: jest.fn((values: Partial<AuthUserRecord>) => values),
    save: jest.fn(async (values: Partial<AuthUserRecord>) => row(values)),
    findOne: jest.fn().mockResolvedValue(user),
  };
  const dataSource = { getRepository: jest.fn(() => repository) } as unknown as DataSource;
  const config = new ConfigService({
    JWT_SECRET: ACCESS_SECRET,
    JWT_REFRESH_SECRET: REFRESH_SECRET,
    JWT_EXPIRES_IN: String(EXPIRES_IN),
  });
  const jwt = new JwtService({ secret: ACCESS_SECRET });
  const service = new AuthService(dataSource, config, jwt, new LoginRateLimitService(config));

  return { service, repository, queryBuilder, jwt };
};

const registerDto = {
  name: 'New User',
  email: 'new@example.com',
  password: 'secret123',
  password_confirmation: 'secret123',
};

describe('AuthService', () => {
  beforeEach(() => {
    // failed logins are counted in process memory: start every case from zero
    resetLoginRateLimits();
  });

  describe('register', () => {
    it('returns a token pair and never exposes the password hash', async () => {
      const { service, repository } = createHarness(null);

      const tokens = await service.register(registerDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', role: 'user' }),
      );
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.expires_in).toBe(EXPIRES_IN);
      expect(tokens.token).toBeDefined();
      expect(tokens).not.toHaveProperty('access_token');
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.user).not.toHaveProperty('password');
    });

    it('rejects a mismatching password confirmation without a query', async () => {
      const { service, repository } = createHarness();

      await expect(
        service.register({ ...registerDto, password_confirmation: 'nope' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate email with 422', async () => {
      const { service } = createHarness(row());

      await expect(service.register(registerDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const password = await hashPassword('secret123');
      const { service } = createHarness(row({ password }));

      const tokens = await service.login({ email: 'admin@example.com', password: 'secret123' });

      expect(tokens.user.email).toBe('admin@example.com');
      expect(tokens.user).not.toHaveProperty('password');
    });

    it('rejects a wrong password with 401', async () => {
      const password = await hashPassword('secret123');
      const { service } = createHarness(row({ password }));

      await expect(
        service.login({ email: 'admin@example.com', password: 'not-the-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email with 401', async () => {
      const { service } = createHarness(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'secret123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates the pair and blacklists the refresh token that was used', async () => {
      const password = await hashPassword('secret123');
      const { service, jwt } = createHarness(row({ password }));
      const tokens = await service.login({ email: 'admin@example.com', password: 'secret123' });
      const payload = jwt.verify<JwtPayload>(tokens.refresh_token, { secret: REFRESH_SECRET });

      const rotated = await service.refresh(tokens.refresh_token);

      expect(rotated.token).not.toBe(tokens.token);
      expect(service.isRevoked(payload)).toBe(true);
      await expect(service.refresh(tokens.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('refuses an access token presented as a refresh token', async () => {
      const password = await hashPassword('secret123');
      const { service, jwt } = createHarness(row({ password }));
      const tokens = await service.login({ email: 'admin@example.com', password: 'secret123' });

      await expect(service.refresh(tokens.token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(jwt).toBeDefined();
    });
  });

  describe('logout', () => {
    it('blacklists the presented token until it expires', async () => {
      const { service } = createHarness();
      const expiresAt = Math.floor(Date.now() / 1000) + 600;

      await expect(service.logout('jti-1', expiresAt)).resolves.toBeNull();
      expect(service.isRevoked({ sub: 1, email: 'a@b.c', role: 'user', jti: 'jti-1', exp: expiresAt })).toBe(
        true,
      );
    });
  });

  describe('me', () => {
    it('returns the public profile', async () => {
      const { service } = createHarness();

      await expect(service.me(1)).resolves.toEqual(
        expect.objectContaining({ id: 1, email: 'admin@example.com', role: 'admin' }),
      );
    });

    it('rejects a user that no longer exists', async () => {
      const { service } = createHarness(null);

      await expect(service.me(1)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
