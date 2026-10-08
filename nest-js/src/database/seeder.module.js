const { Module } = require('@nestjs/common');
const { SeederService } = require('./seeder.service');

@Module({
  providers: [SeederService],
  exports: [SeederService],
})
class SeederModule {}

module.exports = { SeederModule };
