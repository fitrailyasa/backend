const { Module } = require('@nestjs/common');
const { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } = require('@nestjs/core');
const { ConfigModule } = require('@nestjs/config');
const { DatabaseModule } = require('./database/database.module');
const { SeederModule } = require('./database/seeder.module');
const { AuthModule } = require('./auth/auth.module');
const { UsersModule } = require('./users/users.module');
const { CategoriesModule } = require('./categories/categories.module');
const { ProductsModule } = require('./products/products.module');
const { TagsModule } = require('./tags/tags.module');
const { OrdersModule } = require('./orders/orders.module');
const { CommentsModule } = require('./comments/comments.module');
const { HealthModule } = require('./health/health.module');
const { JwtAuthGuard } = require('./common/guards/jwt-auth.guard');
const { RolesGuard } = require('./common/guards/roles.guard');
const { AllExceptionsFilter } = require('./common/filters/all-exceptions.filter');
const { TransformInterceptor } = require('./common/interceptors/transform.interceptor');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    SeederModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    TagsModule,
    OrdersModule,
    CommentsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
class AppModule {}

module.exports = { AppModule };
