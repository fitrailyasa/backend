const { ForbiddenException, NotFoundException, UnprocessableEntityException } = require('@nestjs/common');
const { QueryFailedError } = require('typeorm');
const { AllExceptionsFilter } = require('./all-exceptions.filter');

/**
 * Runs the filter and returns { status, body }.
 */
const run = (exception) => {
  const captured = { status: 0, body: undefined };
  const response = {
    status: (code) => { captured.status = code; return response; },
    json:   (body) => { captured.body  = body;  return response; },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest:  () => ({ method: 'GET', originalUrl: '/api/v1/products' }),
    }),
  };

  new AllExceptionsFilter().catch(exception, host);

  return captured;
};

describe('AllExceptionsFilter', () => {
  it('maps a 404 to the failure envelope', () => {
    const result = run(new NotFoundException('Product not found.'));

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ success: false, message: 'Product not found.' });
  });

  it('maps a 403 without leaking internals', () => {
    const result = run(new ForbiddenException());

    expect(result.status).toBe(403);
    expect(result.body).toEqual({ success: false, message: 'Forbidden' });
  });

  it('keeps the per field errors of a 422', () => {
    const result = run(
      new UnprocessableEntityException({
        message: 'Validation failed',
        errors: { email: ['The email has already been taken.'] },
      }),
    );

    expect(result.status).toBe(422);
    expect(result.body).toEqual({
      success: false,
      message: 'Validation failed',
      errors: { email: ['The email has already been taken.'] },
    });
  });

  it('joins the message array produced by a failed pipe', () => {
    const result = run(new UnprocessableEntityException(['name must be a string', 'email is bad']));

    expect(result.body).toEqual({
      success: false,
      message: 'name must be a string, email is bad',
    });
  });

  it('turns a duplicate key driver error into a 409', () => {
    const error = new QueryFailedError('INSERT INTO users ...', [], {
      code: 'ER_DUP_ENTRY',
    });

    const result = run(error);

    expect(result.status).toBe(409);
    expect(result.body).toEqual({ success: false, message: 'Resource already exists.' });
  });

  it('hides unexpected errors behind a generic 500', () => {
    const result = run(new Error('connection pool exhausted at /srv/secret'));

    expect(result.status).toBe(500);
    expect(result.body).toEqual({ success: false, message: 'Internal server error' });
  });
});
