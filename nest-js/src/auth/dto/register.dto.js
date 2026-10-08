const { ApiProperty } = require('@nestjs/swagger');
const { Trim, LowerCase } = require('../../common/decorators/transform.decorator');
const { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } = require('../../common/utils/password');
const {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  registerDecorator,
} = require('class-validator');

/**
 * Cross field validation: `password_confirmation` must equal `password`.
 */
const MatchesProperty = (property, validationOptions) => (object, propertyName) => {
  registerDecorator({
    name: 'matchesProperty',
    target: object.constructor,
    propertyName,
    options: validationOptions,
    constraints: [property],
    validator: {
      validate: (value, args) => value === args.object[args.constraints[0]],
      defaultMessage: (args) => `${args.property} must match ${args.constraints[0]}`,
    },
  });
};

class RegisterDto {
  @ApiProperty({ type: String, example: 'John Doe', minLength: 3, maxLength: 100 })
  @Trim()
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name should not be empty' })
  @MinLength(3, { message: 'name must be longer than or equal to 3 characters' })
  @MaxLength(100, { message: 'name must be shorter than or equal to 100 characters' })
  name;

  @ApiProperty({ type: String, example: 'john@example.com', maxLength: 150 })
  @LowerCase()
  @IsEmail({}, { message: 'email must be an email' })
  @MaxLength(150, { message: 'email must be shorter than or equal to 150 characters' })
  email;

  @ApiProperty({ type: String, example: 'password', minLength: 8, maxLength: 72, writeOnly: true })
  @IsString({ message: 'password must be a string' })
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password;

  @ApiProperty({ type: String, example: 'password', minLength: 8, writeOnly: true })
  @IsString({ message: 'password_confirmation must be a string' })
  @MatchesProperty('password', { message: 'password_confirmation must match password' })
  password_confirmation;
}

module.exports = { RegisterDto, MatchesProperty };
