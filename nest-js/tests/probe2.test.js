const { RegisterDto } = require('../src/auth/dto/register.dto');
const { CreateUserDto } = require('../src/users/dto/create-user.dto');

describe('metadata probe', () => {
  it('prints reflect metadata', () => {
    console.log('design:type name =', Reflect.getMetadata('design:type', RegisterDto.prototype, 'name'));
    console.log('design:type password =', Reflect.getMetadata('design:type', RegisterDto.prototype, 'password'));
    console.log('api name =', JSON.stringify(Reflect.getMetadata('swagger/apiModelProperties', RegisterDto.prototype, 'name')));
    console.log('design:type user name =', Reflect.getMetadata('design:type', CreateUserDto.prototype, 'name'));
  });
});
