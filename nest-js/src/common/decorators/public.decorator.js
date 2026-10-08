const { SetMetadata } = require('@nestjs/common');

const IS_PUBLIC_KEY = 'auth:public';

const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

module.exports = { Public, IS_PUBLIC_KEY };
