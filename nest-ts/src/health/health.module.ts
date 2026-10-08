import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { IndexController } from './index.controller';

@Module({
  controllers: [HealthController, IndexController],
})
export class HealthModule {}
