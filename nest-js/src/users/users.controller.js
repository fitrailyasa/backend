const { Controller, Get, Post, Put, Patch, Delete, Param, ParseIntPipe, Inject } = require('@nestjs/common');
const { ApiTags, ApiOperation, ApiBearerAuth } = require('@nestjs/swagger');
const { UsersService } = require('./users.service');
const { CreateUserDto } = require('./dto/create-user.dto');
const { UpdateUserDto } = require('./dto/update-user.dto');
const { PaginationQueryDto } = require('../common/dto/pagination.dto');
const { Roles } = require('../common/decorators/roles.decorator');
const { CurrentUser } = require('../common/decorators/current-user.decorator');
const { ValidatedBody, ValidatedQuery } = require('../common/decorators/validated.decorator');

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
class UsersController {
  @Inject(UsersService)
  usersService;

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  me(@CurrentUser() user) {
    return this.usersService.findMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  updateMe(@CurrentUser() user, @ValidatedBody(UpdateUserDto) payload) {
    return this.usersService.updateProfile(user.id, payload);
  }

  @Roles('admin')
  @Get()
  @ApiOperation({ summary: 'List users (admin only)' })
  findAll(@ValidatedQuery(PaginationQueryDto) query) {
    return this.usersService.findAll(query);
  }

  @Roles('admin')
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  findOne(@Param('id', ParseIntPipe) id) {
    return this.usersService.findOne(id);
  }

  @Roles('admin')
  @Post()
  @ApiOperation({ summary: 'Create user (admin only)' })
  create(@ValidatedBody(CreateUserDto) payload) {
    return this.usersService.create(payload);
  }

  @Roles('admin')
  @Put(':id')
  @ApiOperation({ summary: 'Replace user (admin only)' })
  replace(@Param('id', ParseIntPipe) id, @ValidatedBody(CreateUserDto) payload) {
    return this.usersService.update(id, payload);
  }

  @Roles('admin')
  @Patch(':id')
  @ApiOperation({ summary: 'Update user (admin only)' })
  update(@Param('id', ParseIntPipe) id, @ValidatedBody(UpdateUserDto) payload) {
    return this.usersService.update(id, payload);
  }

  @Roles('admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (admin only)' })
  remove(@Param('id', ParseIntPipe) id) {
    return this.usersService.remove(id);
  }
}

module.exports = { UsersController };
