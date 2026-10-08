const { SetMetadata } = require('@nestjs/common');

const RESPONSE_MESSAGE_KEY = 'response:message';

const ResponseMessage = (message) => SetMetadata(RESPONSE_MESSAGE_KEY, message);

module.exports = { ResponseMessage, RESPONSE_MESSAGE_KEY };
