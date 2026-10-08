const { Module } = require('@nestjs/common');
const { HealthController } = require('./health.controller');
const { IndexController } = require('./index.controller');

@Module({
  controllers: [HealthController, IndexController],
})
class HealthModule {}

module.exports = { HealthModule };
