const { Injectable, UnauthorizedException } = require('@nestjs/common');
const { PassportStrategy } = require('@nestjs/passport');
const { ExtractJwt, Strategy } = require('passport-jwt');

@Injectable()
class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config, authService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'change-me-super-secret-access-token'),
    });
    this.authService = authService;
  }

  async validate(payload) {
    if (payload.jti && this.authService.isBlacklisted(payload.jti)) {
      throw new UnauthorizedException('The token has been revoked.');
    }

    const user = await this.authService.findById(Number(payload.sub));
    if (!user) {
      throw new UnauthorizedException('The token is no longer valid.');
    }

    return {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      jti: payload.jti,
      exp: payload.exp ?? 0,
    };
  }
}

module.exports = { JwtStrategy };
