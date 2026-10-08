const { createParamDecorator } = require('@nestjs/common');

/**
 * Injects the authenticated user, or one of its properties when a key is passed.
 */
const CurrentUser = createParamDecorator((key, context) => {
  const request = context.switchToHttp().getRequest();
  const user = request.user ?? null;

  return key && user ? user[key] : user;
});

module.exports = { CurrentUser };
