import { ValidationError } from 'class-validator';
import { flattenValidationErrors } from './validation-errors';

describe('flattenValidationErrors', () => {
  it('maps constraints to a per field list', () => {
    const errors: ValidationError[] = [
      { property: 'email', constraints: { isEmail: 'email must be an email' } },
    ];

    expect(flattenValidationErrors(errors)).toEqual({ email: ['email must be an email'] });
  });

  it('prefixes nested children with the parent path', () => {
    const errors: ValidationError[] = [
      {
        property: 'items',
        children: [
          { property: '0', children: [{ property: 'quantity', constraints: { min: 'too small' } }] },
        ],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual({ 'items.0.quantity': ['too small'] });
  });

  it('returns an empty object for no errors', () => {
    expect(flattenValidationErrors([])).toEqual({});
  });
});
