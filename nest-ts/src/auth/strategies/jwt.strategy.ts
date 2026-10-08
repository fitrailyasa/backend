import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'change-me-super-secret-access-token',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (this.authService.isRevoked(payload)) {
      throw new UnauthorizedException('The token has been revoked.');
    }

    const user = await this.authService.findAuthUser(Number(payload.sub));

    if (!user) {
      throw new UnauthorizedException('The token is no longer valid.');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      jti: payload.jti,
      exp: payload.exp ?? 0,
    };
  }
}
