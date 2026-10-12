import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { LoginRateLimitGuard } from '../common/security/login-rate-limit.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ResponseMessage('User registered successfully')
  @ApiOperation({ summary: 'Create an account and receive a token pair' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(LoginRateLimitGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login successful')
  @ApiOperation({ summary: 'Exchange credentials for a token pair' })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, request);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ResponseMessage('Token refreshed successfully')
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  refresh(@Req() request: Request) {
    return this.authService.refresh(this.bearerToken(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged out successfully')
  @ApiOperation({ summary: 'Blacklist the current access token' })
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.jti, user.exp);
  }

  @Get('me')
  @ResponseMessage('Authenticated user retrieved')
  @ApiOperation({ summary: 'Profile of the authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  private bearerToken(request: Request): string {
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('A refresh token is required.');
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token) {
      throw new UnauthorizedException('A refresh token is required.');
    }

    return token;
  }
}
