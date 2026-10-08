const { Controller, Get } = require('@nestjs/common');
const { ApiTags, ApiOperation } = require('@nestjs/swagger');
const { Public } = require('../common/decorators/public.decorator');

@ApiTags('Health')
@Controller('health')
class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  health() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { HealthController };
