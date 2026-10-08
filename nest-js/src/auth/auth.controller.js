const { Controller, Get, HttpCode, HttpStatus, Inject, Post, Req } = require('@nestjs/common');
const { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } = require('@nestjs/swagger');
const { AuthService } = require('./auth.service');
const { RegisterDto } = require('./dto/register.dto');
const { LoginDto } = require('./dto/login.dto');
const { Public } = require('../common/decorators/public.decorator');
const { CurrentUser } = require('../common/decorators/current-user.decorator');
const { ValidatedBody } = require('../common/decorators/validated.decorator');

@ApiTags('auth')
@Controller('auth')
class AuthController {
  @Inject(AuthService)
  authService;

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user, always with the role `user`' })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ description: 'Returns the access token, the refresh token and the user.' })
  register(@ValidatedBody(RegisterDto) payload) {
    return this.authService.register(payload);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange email and password for a token pair' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Returns the access token, the refresh token and the user.' })
  login(@ValidatedBody(LoginDto) payload) {
    return this.authService.login(payload);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a new token pair from a refresh token' })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Returns a freshly signed token pair.' })
  refresh(@Req() request) {
    return this.authService.refreshFromRequest(request);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Blacklist the token used for this request' })
  @ApiOkResponse({ description: 'The current access token can no longer be used.' })
  logout(@CurrentUser() user) {
    return this.authService.logout(user);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Return the currently authenticated user' })
  @ApiOkResponse({ description: 'Returns the authenticated user, never including the password.' })
  me(@CurrentUser() user) {
    return this.authService.me(user.id);
  }
}

module.exports = { AuthController };
