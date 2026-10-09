import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserListQueryDto } from '../common/dto/pagination.dto';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ResponseMessage('User retrieved')
  @ApiOperation({ summary: 'Profile of the authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(user.id);
  }

  @Patch('me')
  @ResponseMessage('Profile updated successfully')
  @ApiOperation({ summary: 'Update own profile' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get()
  @Roles('admin')
  @ResponseMessage('Users retrieved')
  @ApiOperation({ summary: 'List users (admin only)' })
  findAll(@Query() query: UserListQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Roles('admin')
  @ResponseMessage('User retrieved')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Get a single user (admin only)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles('admin')
  @ResponseMessage('User created')
  @ApiOperation({ summary: 'Create a user (admin only)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @Roles('admin')
  @ResponseMessage('User updated')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Replace a user (admin only)' })
  replace(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id')
  @Roles('admin')
  @ResponseMessage('User updated')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Update a user (admin only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ResponseMessage('User deleted')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Delete a user (admin only)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') actorId: number) {
    return this.usersService.remove(id, actorId);
  }
}
