import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { Paginated } from '../common/utils/api-response';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { applySorting, searchPattern } from '../common/utils/query';
import { hashPassword } from '../common/utils/password';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserRole } from './entities/user.entity';

const SORTABLE = {
  id: 'id',
  name: 'name',
  email: 'email',
  role: 'role',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
} as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repository: Repository<User>,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<Paginated<User>> {
    const qb = this.repository.createQueryBuilder('user');

    if (query.search) {
      qb.andWhere('(user.name LIKE :search OR user.email LIKE :search)', {
        search: searchPattern(query.search),
      });
    }

    applySorting(qb, 'user', SORTABLE, query.sort, query.order, 'created_at');

    const [items, total] = await qb.skip(query.skip).take(query.take).getManyAndCount();

    return new Paginated(items, total, query.page, query.limit);
  }

  async findOne(id: number): Promise<User> {
    const user = await this.repository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    await this.assertEmailAvailable(dto.email);

    const user = this.repository.create({
      name: dto.name,
      email: dto.email,
      password: await hashPassword(dto.password),
      role: dto.role ?? UserRole.USER,
    });

    return this.repository.save(user);
  }

  async updateProfile(id: number, dto: UpdateUserDto): Promise<User> {
    const rest = { ...dto };
    delete rest.role;
    return this.update(id, rest);
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.email !== undefined && dto.email !== user.email) {
      await this.assertEmailAvailable(dto.email, id);
    }

    const changes: QueryDeepPartialEntity<User> = {};

    if (dto.name !== undefined) {
      changes.name = dto.name;
    }

    if (dto.email !== undefined) {
      changes.email = dto.email;
    }

    if (dto.role !== undefined) {
      changes.role = dto.role;
    }

    if (dto.password !== undefined) {
      changes.password = await hashPassword(dto.password);
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update(id, changes);
    }

    return this.findOne(id);
  }

  async remove(id: number, actorId: number): Promise<null> {
    const user = await this.findOne(id);

    if (user.id === actorId) {
      throw new ConflictException('You cannot delete your own account.');
    }

    await this.repository.remove(user);

    return null;
  }

  private async assertEmailAvailable(email: string, excludeId?: number): Promise<void> {
    const qb = this.repository
      .createQueryBuilder('user')
      .where('user.email = :email', { email });

    if (excludeId !== undefined) {
      qb.andWhere('user.id != :excludeId', { excludeId });
    }

    if (await qb.getExists()) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        errors: { email: ['The email has already been taken.'] },
      });
    }
  }
}

