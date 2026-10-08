const { Module } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { User } = require('./entities/user.entity');
const { UsersController } = require('./users.controller');
const { UsersService } = require('./users.service');

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
class UsersModule {}

module.exports = { UsersModule };
