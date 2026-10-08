const { Injectable, Inject, NotFoundException, UnprocessableEntityException } = require('@nestjs/common');
const { InjectRepository } = require('@nestjs/typeorm');
const { ConfigService } = require('@nestjs/config');
const { Brackets } = require('typeorm');
const { hashPassword } = require('../common/utils/password');
const { User } = require('./entities/user.entity');
const { ok, paginated } = require('../common/utils/api-response');
const { buildPagination, resolveSortColumn, searchPattern } = require('../common/utils/query');

const SORTABLE = ['id', 'name', 'email', 'role', 'created_at', 'updated_at'];

@Injectable()
class UsersService {
  @InjectRepository(User)
  userRepository;

  @Inject(ConfigService)
  config;

  pagination(query) {
    return buildPagination(query, {
      defaultLimit: this.config.get('PAGINATION_DEFAULT_LIMIT', 10),
      maxLimit: this.config.get('PAGINATION_MAX_LIMIT', 100),
    });
  }

  saltRounds() {
    return Number(this.config.get('BCRYPT_SALT_ROUNDS', 10));
  }

  async findAll(query) {
    const pagination = this.pagination(query);
    const builder = this.userRepository.createQueryBuilder('user');

    if (pagination.search) {
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('user.name LIKE :search', { search: searchPattern(pagination.search) })
            .orWhere('user.email LIKE :search', { search: searchPattern(pagination.search) });
        }),
      );
    }

    const sort = resolveSortColumn(pagination.sort, SORTABLE);

    builder.orderBy(`user.${sort}`, pagination.order).skip(pagination.skip).take(pagination.take);

    const [items, total] = await builder.getManyAndCount();

    return paginated(items, total, pagination, 'Users retrieved');
  }

  async findOneOrFail(id) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) throw new NotFoundException('User not found.');

    return user;
  }

  async findOne(id) {
    return ok(await this.findOneOrFail(id), 'User retrieved');
  }

  async findMe(id) {
    return ok(await this.findOneOrFail(id), 'User retrieved');
  }

  async create(payload) {
    const email = payload.email.toLowerCase();
    const existing = await this.userRepository.findOne({ where: { email } });

    if (existing) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        errors: { email: ['The email has already been taken.'] },
      });
    }

    const user = this.userRepository.create({
      name: payload.name,
      email,
      password: await hashPassword(payload.password, this.saltRounds()),
      role: payload.role === 'admin' ? 'admin' : 'user',
    });

    const saved = await this.userRepository.save(user);

    return ok(saved, 'User created successfully');
  }

  async updateProfile(id, payload) {
    const rest = { ...payload };
    delete rest.role;
    const result = await this.update(id, rest);
    return { ...result, message: 'Profile updated successfully' };
  }

  async update(id, payload) {
    const user = await this.findOneOrFail(id);

    if (payload.email && payload.email.toLowerCase() !== user.email) {
      const duplicate = await this.userRepository.findOne({
        where: { email: payload.email.toLowerCase() },
      });

      if (duplicate && String(duplicate.id) !== String(id)) {
        throw new UnprocessableEntityException({
          message: 'Validation failed',
          errors: { email: ['The email has already been taken.'] },
        });
      }
    }

    if (payload.name !== undefined) user.name = payload.name;
    if (payload.email !== undefined) user.email = payload.email.toLowerCase();
    if (payload.role !== undefined) user.role = payload.role;
    if (payload.password !== undefined) {
      user.password = await hashPassword(payload.password, this.saltRounds());
    }

    return ok(await this.userRepository.save(user), 'User updated successfully');
  }

  async remove(id) {
    const user = await this.findOneOrFail(id);

    await this.userRepository.remove(user);

    return ok(null, 'User deleted successfully');
  }
}

module.exports = { UsersService, SORTABLE };
