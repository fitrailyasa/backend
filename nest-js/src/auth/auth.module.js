const { Module } = require('@nestjs/common');
const { JwtModule } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { ConfigModule, ConfigService } = require('@nestjs/config');
const { User } = require('../users/entities/user.entity');
const { AuthController } = require('./auth.controller');
const { AuthService } = require('./auth.service');
const { JwtStrategy } = require('./strategies/jwt.strategy');

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config) => ({
        secret: config.get('JWT_SECRET', 'change-me-super-secret-access-token'),
        signOptions: {
          expiresIn: Number(config.get('JWT_EXPIRES_IN', 3600)),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: JwtStrategy,
      inject: [ConfigService, AuthService],
      useFactory: (config, authService) => new JwtStrategy(config, authService),
    },
  ],
  exports: [AuthService, PassportModule, JwtModule],
})
class AuthModule {}

module.exports = { AuthModule };
