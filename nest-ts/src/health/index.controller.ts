import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

export interface RouteSummary {
  method: string;
  path: string;
  auth: string;
  description: string;
}

const ROUTES: RouteSummary[] = [
  { method: 'GET', path: '/api/v1', auth: 'public', description: 'This route index' },
  { method: 'GET', path: '/health', auth: 'public', description: 'Liveness probe' },
  { method: 'POST', path: '/api/v1/auth/register', auth: 'public', description: 'Create an account' },
  { method: 'POST', path: '/api/v1/auth/login', auth: 'public', description: 'Exchange credentials for tokens' },
  { method: 'POST', path: '/api/v1/auth/refresh', auth: 'bearer (refresh token)', description: 'Rotate the token pair' },
  { method: 'POST', path: '/api/v1/auth/logout', auth: 'bearer', description: 'Blacklist the current token' },
  { method: 'GET', path: '/api/v1/auth/me', auth: 'bearer', description: 'Profile of the caller' },
  { method: 'GET', path: '/api/v1/users/me', auth: 'bearer', description: 'Profile of the caller' },
  { method: 'PATCH', path: '/api/v1/users/me', auth: 'bearer', description: 'Update own profile' },
  { method: 'GET', path: '/api/v1/users', auth: 'admin', description: 'List users' },
  { method: 'GET', path: '/api/v1/users/:id', auth: 'admin', description: 'Get a user' },
  { method: 'POST', path: '/api/v1/users', auth: 'admin', description: 'Create a user' },
  { method: 'PUT', path: '/api/v1/users/:id', auth: 'admin', description: 'Replace a user' },
  { method: 'PATCH', path: '/api/v1/users/:id', auth: 'admin', description: 'Update a user' },
  { method: 'DELETE', path: '/api/v1/users/:id', auth: 'admin', description: 'Delete a user' },
  { method: 'GET', path: '/api/v1/categories', auth: 'public', description: 'List categories' },
  { method: 'GET', path: '/api/v1/categories/:id', auth: 'public', description: 'Get a category' },
  { method: 'POST', path: '/api/v1/categories', auth: 'admin', description: 'Create a category' },
  { method: 'PUT', path: '/api/v1/categories/:id', auth: 'admin', description: 'Replace a category' },
  { method: 'PATCH', path: '/api/v1/categories/:id', auth: 'admin', description: 'Update a category' },
  { method: 'DELETE', path: '/api/v1/categories/:id', auth: 'admin', description: 'Delete a category' },
  { method: 'GET', path: '/api/v1/products', auth: 'public', description: 'List products' },
  { method: 'GET', path: '/api/v1/products/:id', auth: 'public', description: 'Get a product' },
  { method: 'POST', path: '/api/v1/products', auth: 'admin', description: 'Create a product' },
  { method: 'PUT', path: '/api/v1/products/:id', auth: 'admin', description: 'Replace a product' },
  { method: 'PATCH', path: '/api/v1/products/:id', auth: 'admin', description: 'Update a product' },
  { method: 'DELETE', path: '/api/v1/products/:id', auth: 'admin', description: 'Delete a product' },
  { method: 'GET', path: '/api/v1/tags', auth: 'public', description: 'List tags' },
  { method: 'GET', path: '/api/v1/tags/:id', auth: 'public', description: 'Get a tag' },
  { method: 'POST', path: '/api/v1/tags', auth: 'admin', description: 'Create a tag' },
  { method: 'PUT', path: '/api/v1/tags/:id', auth: 'admin', description: 'Replace a tag' },
  { method: 'PATCH', path: '/api/v1/tags/:id', auth: 'admin', description: 'Update a tag' },
  { method: 'DELETE', path: '/api/v1/tags/:id', auth: 'admin', description: 'Delete a tag' },
  { method: 'GET', path: '/api/v1/orders', auth: 'bearer', description: 'List orders (own, or all for admin)' },
  { method: 'GET', path: '/api/v1/orders/:id', auth: 'bearer (owner or admin)', description: 'Get an order' },
  { method: 'POST', path: '/api/v1/orders', auth: 'bearer', description: 'Create an order' },
  { method: 'PATCH', path: '/api/v1/orders/:id/status', auth: 'bearer (owner or admin)', description: 'Update the order status' },
  { method: 'DELETE', path: '/api/v1/orders/:id', auth: 'admin', description: 'Delete an order' },
  { method: 'GET', path: '/api/v1/comments', auth: 'public', description: 'List comments' },
  { method: 'PATCH', path: '/api/v1/comments/:id', auth: 'bearer (owner or admin)', description: 'Update a comment' },
  { method: 'DELETE', path: '/api/v1/comments/:id', auth: 'bearer (owner or admin)', description: 'Delete a comment' },
  { method: 'GET', path: '/api/v1/products/:productId/comments', auth: 'public', description: 'List product comments' },
  { method: 'POST', path: '/api/v1/products/:productId/comments', auth: 'bearer', description: 'Comment on a product' },
];

@ApiTags('Health')
@Controller()
export class IndexController {
  @Public()
  @Get()
  @ResponseMessage('API index retrieved')
  @ApiOperation({ summary: 'Index of every route exposed by the service' })
  index() {
    const port = process.env.PORT || '3003';

    return {
      name: 'backend-starter-nest-ts',
      version: '1.0.0',
      prefix: '/api/v1',
      documentation: '/api/v1/docs',
      endpoints: ROUTES,
      base_url: process.env.API_BASE_URL || `http://localhost:${port}`,
    };
  }
}
