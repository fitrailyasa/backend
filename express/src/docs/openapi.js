const errorSchema = (example) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: 'Validation failed' },
    errors: {
      type: 'object',
      additionalProperties: { type: 'array', items: { type: 'string' } },
      example: example ?? { email: ['The email has already been taken.'] },
    },
  },
  required: ['success', 'message'],
});

const singleResponse = (message, schema = { type: 'object' }) => ({
  description: message,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: message },
          data: schema,
        },
      },
    },
  },
});

const collectionResponse = (message, itemSchema) => ({
  description: message,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: message },
          data: { type: 'array', items: itemSchema },
          meta: { $ref: '#/components/schemas/PaginationMeta' },
        },
      },
    },
  },
});

const standardErrors = {
  400: { description: 'Malformed JSON payload', ...errorSchemaResponse() },
  401: { description: 'Missing, invalid or expired token' },
  403: { description: 'Insufficient role or not the resource owner' },
  404: { description: 'Resource not found' },
  409: { description: 'Conflict, for example a duplicate slug' },
  422: { description: 'Validation failed', content: { 'application/json': { schema: errorSchema() } } },
  429: { description: 'Too many requests' },
  500: { description: 'Internal server error' },
};

function errorSchemaResponse() {
  return { content: { 'application/json': { schema: errorSchema() } } };
}

const jsonBody = (properties, required = []) => ({
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    },
  },
});

const paginationParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
  { name: 'search', in: 'query', schema: { type: 'string' } },
  { name: 'sort', in: 'query', schema: { type: 'string', default: 'id' } },
  { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
];

const includeParam = (values) => ({
  name: 'include',
  in: 'query',
  schema: { type: 'string', enum: values },
  description: `Comma separated eager loads. Allowed: ${values.join(', ')}.`,
});

const idPathParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'integer', minimum: 1 },
};

const errorResponses = (extra = {}) => ({ ...standardErrors, ...extra });

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    name: { type: 'string', example: 'Admin' },
    email: { type: 'string', format: 'email', example: 'admin@example.com' },
    role: { type: 'string', enum: ['user', 'admin'] },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

const categorySchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    name: { type: 'string', example: 'Electronics' },
    slug: { type: 'string', example: 'electronics' },
    description: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

const tagSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    name: { type: 'string', example: 'Gadget' },
    slug: { type: 'string', example: 'gadget' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

const productSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    category_id: { type: 'integer', example: 1 },
    name: { type: 'string', example: 'Smartphone X' },
    slug: { type: 'string', example: 'smartphone-x' },
    description: { type: 'string', nullable: true },
    price: { type: 'number', format: 'double', example: 4990000 },
    stock: { type: 'integer', example: 25 },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

const orderItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    order_id: { type: 'integer', example: 1 },
    product_id: { type: 'integer', example: 1 },
    quantity: { type: 'integer', example: 2 },
    price: { type: 'number', example: 4990000 },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

const orderSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    user_id: { type: 'integer', example: 1 },
    status: { type: 'string', enum: ['pending', 'paid', 'shipped', 'completed', 'cancelled'] },
    total: { type: 'number', example: 9980000 },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

const commentSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    product_id: { type: 'integer', example: 1 },
    user_id: { type: 'integer', example: 1 },
    body: { type: 'string', example: 'Great product!' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

const authTokenSchema = {
  type: 'object',
  properties: {
    user: userSchema,
    token: { type: 'string', description: 'JWT access token' },
    refresh_token: { type: 'string' },
    token_type: { type: 'string', example: 'Bearer' },
    expires_in: { type: 'integer', example: 3600 },
  },
};

const crudPaths = (resource, tag, schemas, options = {}) => {
  const {
    itemName,
    collectionMessage,
    itemMessage,
    extraListParams = [],
    extraStoreProps = [],
    extraUpdateProps = [],
    requiredStore = [],
  } = options;

  const paths = {
    [`/${resource}`]: {
      get: {
        tags: [tag],
        summary: `List ${itemName}`,
        parameters: [...paginationParams, ...extraListParams],
        responses: { 200: collectionResponse(`${collectionMessage}`, schemas.item), ...errorResponses() },
      },
      post: {
        tags: [tag],
        summary: `Create ${itemName}`,
        requestBody: jsonBody({ ...schemas.store, ...extraStoreProps }, requiredStore),
        responses: {
          201: singleResponse(`${itemName} created successfully`, schemas.item),
          ...errorResponses(),
        },
      },
    },
    [`/${resource}/{id}`]: {
      get: {
        tags: [tag],
        summary: `Get ${itemName}`,
        parameters: [idPathParam, ...extraListParams],
        responses: { 200: singleResponse(`${itemMessage}`, schemas.item), ...errorResponses() },
      },
      put: {
        tags: [tag],
        summary: `Replace ${itemName}`,
        parameters: [idPathParam],
        requestBody: jsonBody({ ...schemas.store, ...extraStoreProps }, requiredStore),
        responses: { 200: singleResponse(`${itemName} updated successfully`, schemas.item), ...errorResponses() },
      },
      patch: {
        tags: [tag],
        summary: `Update ${itemName}`,
        parameters: [idPathParam],
        requestBody: jsonBody({ ...schemas.update, ...extraUpdateProps }),
        responses: { 200: singleResponse(`${itemName} updated successfully`, schemas.item), ...errorResponses() },
      },
      delete: {
        tags: [tag],
        summary: `Delete ${itemName}`,
        parameters: [idPathParam],
        responses: { 200: singleResponse(`${itemName} deleted successfully`, { nullable: true }), ...errorResponses() },
      },
    },
  };

  return paths;
};

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Backend Starter Kit API',
    version: '1.0.0',
    description:
      'Shared API contract implemented by every framework folder in this repository. ' +
      'All responses use the envelope `{ success, message, data }`; collections add `meta: { page, limit, total, total_pages }`; ' +
      'errors use `{ success: false, message, errors? }`. The `password` field is never returned.',
    license: { name: 'MIT' },
  },
  servers: [{ url: '/api/v1', description: 'Versioned API base path' }],
  tags: [
    { name: 'Auth', description: 'Registration, login, token lifecycle' },
    { name: 'Users', description: 'User administration' },
    { name: 'Categories', description: 'Product categories' },
    { name: 'Products', description: 'Catalogue' },
    { name: 'Tags', description: 'Product tags' },
    { name: 'Orders', description: 'Customer orders' },
    { name: 'Comments', description: 'Product comments' },
    { name: 'System', description: 'Health and documentation' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 57 },
          total_pages: { type: 'integer', example: 6 },
        },
      },
      User: userSchema,
      Category: categorySchema,
      Tag: tagSchema,
      Product: productSchema,
      OrderItem: orderItemSchema,
      Order: orderSchema,
      Comment: commentSchema,
      Error: errorSchema(),
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        security: [],
        requestBody: jsonBody(
          {
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            password: { type: 'string', format: 'password', minLength: 8, example: 'password' },
            password_confirmation: { type: 'string', format: 'password', minLength: 8, example: 'password' },
          },
          ['name', 'email', 'password', 'password_confirmation'],
        ),
        responses: {
          201: singleResponse('User registered successfully', authTokenSchema),
          ...errorResponses(),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive a token pair',
        security: [],
        requestBody: jsonBody(
          {
            email: { type: 'string', format: 'email', example: 'admin@example.com' },
            password: { type: 'string', format: 'password', example: 'password' },
          },
          ['email', 'password'],
        ),
        responses: { 200: singleResponse('Login successful', authTokenSchema), ...errorResponses() },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange a refresh token for a new token pair',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { refresh_token: { type: 'string' } } },
            },
          },
        },
        responses: { 200: singleResponse('Token refreshed successfully', authTokenSchema), ...errorResponses() },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke the current access token',
        responses: { 200: singleResponse('Logged out successfully', { nullable: true }), ...errorResponses() },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'The currently authenticated user',
        responses: { 200: singleResponse('Authenticated user retrieved', { $ref: '#/components/schemas/User' }), ...errorResponses() },
      },
    },
    ...crudPaths('users', 'Users', {
      item: { $ref: '#/components/schemas/User' },
      store: {
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', format: 'email', example: 'john@example.com' },
        password: { type: 'string', format: 'password', minLength: 8, example: 'password' },
        role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
      },
      update: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        password: { type: 'string', format: 'password', minLength: 8 },
        role: { type: 'string', enum: ['user', 'admin'] },
      },
    }, {
      itemName: 'User',
      collectionMessage: 'Users retrieved',
      itemMessage: 'User retrieved',
      requiredStore: ['name', 'email', 'password'],
    }),

    '/users/me': {
      get: {
        tags: ['Users'],
        summary: 'The currently authenticated user',
        responses: { 200: singleResponse('User retrieved', { $ref: '#/components/schemas/User' }), ...errorResponses() },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update the current user profile',
        requestBody: jsonBody({
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password', minLength: 8 },
          password_confirmation: { type: 'string', format: 'password', minLength: 8 },
        }),
        responses: { 200: singleResponse('Profile updated successfully', { $ref: '#/components/schemas/User' }), ...errorResponses() },
      },
    },

    ...crudPaths('categories', 'Categories', {
      item: { $ref: '#/components/schemas/Category' },
      store: {
        name: { type: 'string', example: 'Electronics' },
        slug: { type: 'string', example: 'electronics' },
        description: { type: 'string', example: 'Gadgets and devices' },
      },
      update: {
        name: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
      },
    }, {
      itemName: 'Category',
      collectionMessage: 'Categories retrieved',
      itemMessage: 'Category retrieved',
      extraListParams: [includeParam(['products'])],
      requiredStore: ['name'],
    }),

    ...crudPaths('products', 'Products', {
      item: { $ref: '#/components/schemas/Product' },
      store: {
        category_id: { type: 'integer', example: 1 },
        name: { type: 'string', example: 'Smartphone X' },
        slug: { type: 'string', example: 'smartphone-x' },
        description: { type: 'string' },
        price: { type: 'number', example: 4990000 },
        stock: { type: 'integer', example: 25 },
      },
      update: {
        category_id: { type: 'integer' },
        name: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        stock: { type: 'integer' },
      },
    }, {
      itemName: 'Product',
      collectionMessage: 'Products retrieved',
      itemMessage: 'Product retrieved',
      extraListParams: [
        includeParam(['category', 'tags']),
        { name: 'category_id', in: 'query', schema: { type: 'integer' } },
        { name: 'tag_id', in: 'query', schema: { type: 'integer' } },
        { name: 'tag', in: 'query', schema: { type: 'string' }, description: 'Filter by tag slug' },
        { name: 'min_price', in: 'query', schema: { type: 'number' } },
        { name: 'max_price', in: 'query', schema: { type: 'number' } },
      ],
      extraStoreProps: {
        tags: {
          type: 'array',
          items: { type: 'integer' },
          example: [1, 2],
          description: 'Tag ids. Accepted by Express, Flask, Django, Spring Boot, and .NET.',
        },
        tag_ids: {
          type: 'array',
          items: { type: 'integer' },
          example: [1, 2],
          description: 'Tag ids. Accepted by NestJS, Laravel, CodeIgniter, and Rails.',
        },
      },
      extraUpdateProps: {
        tags: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Tag ids. Accepted by Express, Flask, Django, Spring Boot, and .NET.',
        },
        tag_ids: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Tag ids. Accepted by NestJS, Laravel, CodeIgniter, and Rails.',
        },
      },
      requiredStore: ['category_id', 'name', 'price'],
    }),

    ...crudPaths('tags', 'Tags', {
      item: { $ref: '#/components/schemas/Tag' },
      store: { name: { type: 'string', example: 'Gadget' }, slug: { type: 'string', example: 'gadget' } },
      update: { name: { type: 'string' }, slug: { type: 'string' } },
    }, {
      itemName: 'Tag',
      collectionMessage: 'Tags retrieved',
      itemMessage: 'Tag retrieved',
      requiredStore: ['name'],
    }),

    '/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List orders. Regular users see their own orders, admins see all',
        parameters: [
          ...paginationParams,
          includeParam(['items', 'items.product', 'user']),
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'paid', 'shipped', 'completed', 'cancelled'] } },
          { name: 'user_id', in: 'query', schema: { type: 'integer' }, description: 'Admin only' },
        ],
        responses: { 200: collectionResponse('Orders retrieved', { $ref: '#/components/schemas/Order' }), ...errorResponses() },
      },
      post: {
        tags: ['Orders'],
        summary: 'Create an order. The total is computed server side and stock is decremented',
        requestBody: jsonBody(
          {
            items: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                properties: { product_id: { type: 'integer', example: 1 }, quantity: { type: 'integer', example: 2 } },
                required: ['product_id', 'quantity'],
              },
            },
          },
          ['items'],
        ),
        responses: { 201: singleResponse('Order created successfully', { $ref: '#/components/schemas/Order' }), ...errorResponses() },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get an order. Owner or admin only',
        parameters: [idPathParam, includeParam(['items', 'items.product', 'user'])],
        responses: { 200: singleResponse('Order retrieved', { $ref: '#/components/schemas/Order' }), ...errorResponses() },
      },
      delete: {
        tags: ['Orders'],
        summary: 'Delete an order. Admin only',
        parameters: [idPathParam],
        responses: { 200: singleResponse('Order deleted successfully', { nullable: true }), ...errorResponses() },
      },
    },
    '/orders/{id}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Update order status. Owners may only move a pending order to cancelled',
        parameters: [idPathParam],
        requestBody: jsonBody(
          { status: { type: 'string', enum: ['pending', 'paid', 'shipped', 'completed', 'cancelled'], example: 'cancelled' } },
          ['status'],
        ),
        responses: { 200: singleResponse('Order status updated successfully', { $ref: '#/components/schemas/Order' }), ...errorResponses() },
      },
    },

    '/products/{productId}/comments': {
      get: {
        tags: ['Comments'],
        summary: 'List comments for a product',
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } },
          ...paginationParams,
          includeParam(['user', 'product']),
          { name: 'product_id', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: collectionResponse('Comments retrieved', { $ref: '#/components/schemas/Comment' }), ...errorResponses() },
      },
      post: {
        tags: ['Comments'],
        summary: 'Create a comment on a product',
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        requestBody: jsonBody({ body: { type: 'string', example: 'Great product!' } }, ['body']),
        responses: { 201: singleResponse('Comment created successfully', { $ref: '#/components/schemas/Comment' }), ...errorResponses() },
      },
    },
    '/comments': {
      get: {
        tags: ['Comments'],
        summary: 'List comments across products',
        parameters: [
          ...paginationParams,
          includeParam(['user', 'product']),
          { name: 'product_id', in: 'query', schema: { type: 'integer' } },
          { name: 'user_id', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: collectionResponse('Comments retrieved', { $ref: '#/components/schemas/Comment' }), ...errorResponses() },
      },
    },
    '/comments/{id}': {
      patch: {
        tags: ['Comments'],
        summary: 'Update a comment. Owner or admin only',
        parameters: [idPathParam],
        requestBody: jsonBody({ body: { type: 'string' } }, ['body']),
        responses: { 200: singleResponse('Comment updated successfully', { $ref: '#/components/schemas/Comment' }), ...errorResponses() },
      },
      delete: {
        tags: ['Comments'],
        summary: 'Delete a comment. Owner or admin only',
        parameters: [idPathParam],
        responses: { 200: singleResponse('Comment deleted successfully', { nullable: true }), ...errorResponses() },
      },
    },

    '/': {
      get: {
        tags: ['System'],
        summary: 'API index listing every available route',
        security: [],
        responses: { 200: singleResponse('API index retrieved', { type: 'object' }) },
      },
    },
    '/docs': {
      get: {
        tags: ['System'],
        summary: 'Swagger UI for this API',
        security: [],
        responses: {
          200: {
            description: 'Swagger UI',
            content: { 'text/html': { schema: { type: 'string', format: 'html' } } },
          },
        },
      },
    },
    '/docs.json': {
      get: {
        tags: ['System'],
        summary: 'This OpenAPI 3.0 document',
        security: [],
        responses: { 200: { description: 'OpenAPI document', content: { 'application/json': { schema: { type: 'object' } } } } },
      },
    },
  },
};

export const routesIndex = {
  name: 'backend-starter-express',
  version: '1.0.0',
  prefix: '/api/v1',
  documentation: '/api/v1/docs',
  endpoints: [
    { method: 'GET', path: '/health', auth: 'public', description: 'Liveness probe' },
    { method: 'GET', path: '/api/v1', auth: 'public', description: 'API index' },
    { method: 'GET', path: '/api/v1/docs', auth: 'public', description: 'Swagger UI' },
    { method: 'GET', path: '/api/v1/docs.json', auth: 'public', description: 'OpenAPI 3.0 document' },

    { method: 'POST', path: '/api/v1/auth/register', auth: 'public', description: 'Register, returns token + user' },
    { method: 'POST', path: '/api/v1/auth/login', auth: 'public', description: 'Login, returns token + user' },
    { method: 'POST', path: '/api/v1/auth/refresh', auth: 'bearer', description: 'Issue a new token pair' },
    { method: 'POST', path: '/api/v1/auth/logout', auth: 'bearer', description: 'Revoke the current token' },
    { method: 'GET', path: '/api/v1/auth/me', auth: 'bearer', description: 'Current user' },

    { method: 'GET', path: '/api/v1/users', auth: 'admin', description: 'List users' },
    { method: 'POST', path: '/api/v1/users', auth: 'admin', description: 'Create a user' },
    { method: 'GET', path: '/api/v1/users/me', auth: 'bearer', description: 'Current user profile' },
    { method: 'PATCH', path: '/api/v1/users/me', auth: 'bearer', description: 'Update own profile' },
    { method: 'GET', path: '/api/v1/users/{id}', auth: 'admin', description: 'Get a user' },
    { method: 'PUT', path: '/api/v1/users/{id}', auth: 'admin', description: 'Replace a user' },
    { method: 'PATCH', path: '/api/v1/users/{id}', auth: 'admin', description: 'Update a user' },
    { method: 'DELETE', path: '/api/v1/users/{id}', auth: 'admin', description: 'Delete a user' },

    { method: 'GET', path: '/api/v1/categories', auth: 'public', description: 'List categories' },
    { method: 'GET', path: '/api/v1/categories/{id}', auth: 'public', description: 'Get a category' },
    { method: 'POST', path: '/api/v1/categories', auth: 'admin', description: 'Create a category' },
    { method: 'PUT', path: '/api/v1/categories/{id}', auth: 'admin', description: 'Replace a category' },
    { method: 'PATCH', path: '/api/v1/categories/{id}', auth: 'admin', description: 'Update a category' },
    { method: 'DELETE', path: '/api/v1/categories/{id}', auth: 'admin', description: 'Delete a category' },

    { method: 'GET', path: '/api/v1/products', auth: 'public', description: 'List products, filter by category_id, tag_id, tag, min_price, max_price' },
    { method: 'GET', path: '/api/v1/products/{id}', auth: 'public', description: 'Get a product' },
    { method: 'POST', path: '/api/v1/products', auth: 'admin', description: 'Create a product' },
    { method: 'PUT', path: '/api/v1/products/{id}', auth: 'admin', description: 'Replace a product' },
    { method: 'PATCH', path: '/api/v1/products/{id}', auth: 'admin', description: 'Update a product' },
    { method: 'DELETE', path: '/api/v1/products/{id}', auth: 'admin', description: 'Delete a product' },

    { method: 'GET', path: '/api/v1/tags', auth: 'public', description: 'List tags' },
    { method: 'GET', path: '/api/v1/tags/{id}', auth: 'public', description: 'Get a tag' },
    { method: 'POST', path: '/api/v1/tags', auth: 'admin', description: 'Create a tag' },
    { method: 'PUT', path: '/api/v1/tags/{id}', auth: 'admin', description: 'Replace a tag' },
    { method: 'PATCH', path: '/api/v1/tags/{id}', auth: 'admin', description: 'Update a tag' },
    { method: 'DELETE', path: '/api/v1/tags/{id}', auth: 'admin', description: 'Delete a tag' },

    { method: 'GET', path: '/api/v1/orders', auth: 'bearer', description: 'List orders, filter by status (and user_id for admins)' },
    { method: 'POST', path: '/api/v1/orders', auth: 'bearer', description: 'Create an order from items' },
    { method: 'GET', path: '/api/v1/orders/{id}', auth: 'bearer', description: 'Get an order, owner or admin' },
    { method: 'PATCH', path: '/api/v1/orders/{id}/status', auth: 'bearer', description: 'Update status, admin or owner cancelling a pending order' },
    { method: 'DELETE', path: '/api/v1/orders/{id}', auth: 'admin', description: 'Delete an order' },

    { method: 'GET', path: '/api/v1/products/{productId}/comments', auth: 'public', description: 'List comments for a product' },
    { method: 'POST', path: '/api/v1/products/{productId}/comments', auth: 'bearer', description: 'Create a comment' },
    { method: 'GET', path: '/api/v1/comments', auth: 'public', description: 'List comments, filter by product_id' },
    { method: 'PATCH', path: '/api/v1/comments/{id}', auth: 'owner or admin', description: 'Update a comment' },
    { method: 'DELETE', path: '/api/v1/comments/{id}', auth: 'owner or admin', description: 'Delete a comment' },
  ],
};

export default openapi;
