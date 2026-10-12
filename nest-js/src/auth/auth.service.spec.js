const { UnauthorizedException, UnprocessableEntityException } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { ConfigService } = require('@nestjs/config');
const { hashPassword } = require('../common/utils/password');
const { LoginRateLimitService } = require('../common/security/login-rate-limit.service');
const { AuthService } = require('./auth.service');

const ACCESS_SECRET = 'test-secret-key-that-is-long-enough-1234567890';
const EXPIRES_IN = 3600;

const row = (overrides = {}) => ({
  id: 1,
  name: 'Admin',
  email: 'admin@example.com',
  password: '',
  role: 'admin',
  created_at: new Date('2024-01-01T00:00:00.000Z'),
  updated_at: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

/**
 * Creates an AuthService instance with mocked dependencies.
 * Since AuthService uses property injection decorators, we manually
 * set the injected properties after creation.
 */
const createHarness = (user = row()) => {
  const queryBuilder = {
    where:     jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getOne:    jest.fn().mockResolvedValue(user),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    create: jest.fn((values) => values),
    save:   jest.fn(async (values) => row(values)),
  };

  const config = new ConfigService({
    JWT_SECRET:        ACCESS_SECRET,
    JWT_EXPIRES_IN:    String(EXPIRES_IN),
    BCRYPT_SALT_ROUNDS: '4',
  });

  const jwtService = new JwtService({ secret: ACCESS_SECRET });

  // AuthService uses @Inject / @InjectRepository decorators (property injection).
  // We create an instance and manually assign the private properties.
  const service = new AuthService();
  service.userRepository = repository;
  service.jwtService     = jwtService;
  service.config         = config;
  service.loginRateLimit = new LoginRateLimitService();
  service.loginRateLimit.config = config;

  return { service, repository, queryBuilder, jwtService };
};

const registerDto = {
  name: 'New User',
  email: 'new@example.com',
  password: 'secret123',
  password_confirmation: 'secret123',
};

describe('AuthService', () => {
  describe('register', () => {
    it('returns a token pair and never exposes the password hash', async () => {
      const { service, repository } = createHarness(null);

      const result = await service.register(registerDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', role: 'user' }),
      );
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(result.data.token_type).toBe('Bearer');
      expect(result.data.expires_in).toBe(EXPIRES_IN);
      expect(result.data.token).toBeDefined();
      expect(result.data.refresh_token).toBeDefined();
      expect(result.data.user).not.toHaveProperty('password');
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
      const password = await hashPassword('secret123', 4);
      const { service } = createHarness(row({ password }));

      const result = await service.login({ email: 'admin@example.com', password: 'secret123' });

      expect(result.data.user.email).toBe('admin@example.com');
      expect(result.data.user).not.toHaveProperty('password');
    });

    it('rejects a wrong password with 401', async () => {
      const password = await hashPassword('secret123', 4);
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
    it('issues a new pair when the refresh token is valid', async () => {
      const password = await hashPassword('secret123', 4);
      const { service } = createHarness(row({ password }));

      const loginResult = await service.login({ email: 'admin@example.com', password: 'secret123' });
      const firstToken = loginResult.data.token;

      const refreshResult = await service.refresh(loginResult.data.refresh_token);

      expect(refreshResult.token).toBeDefined();
      // Access tokens are fresh (may differ)
      expect(typeof refreshResult.token).toBe('string');
    });

    it('rejects an access token presented as a refresh token', async () => {
      const password = await hashPassword('secret123', 4);
      const { service } = createHarness(row({ password }));

      const loginResult = await service.login({ email: 'admin@example.com', password: 'secret123' });

      await expect(service.refresh(loginResult.data.token)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('blacklists the presented jti', async () => {
      const { service } = createHarness();
      const expiresAt = Math.floor(Date.now() / 1000) + 600;

      service.blacklist('jti-1', expiresAt);
      expect(service.isBlacklisted('jti-1')).toBe(true);
    });

    it('logout returns a message', async () => {
      const { service } = createHarness();
      const user = { jti: 'jti-test', exp: Math.floor(Date.now() / 1000) + 600 };

      const result = await service.logout(user);
      expect(result.message).toBeDefined();
    });
  });

  describe('me', () => {
    it('returns the public profile without password', async () => {
      const { service } = createHarness();

      const result = await service.me(1);

      expect(result.data).toMatchObject({ id: 1, email: 'admin@example.com', role: 'admin' });
      expect(result.data).not.toHaveProperty('password');
    });
  });
});
