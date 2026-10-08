import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { Paginated } from '../common/utils/api-response';
import { applySorting, searchPattern } from '../common/utils/query';
import { buildUniqueSlug } from '../common/utils/slugify';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from './entities/tag.entity';

const SORTABLE = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
} as const;

@Injectable()
export class TagsService {
  constructor(@InjectRepository(Tag) private readonly repository: Repository<Tag>) {}

  async findAll(query: PaginationQueryDto): Promise<Paginated<Tag>> {
    const qb = this.repository.createQueryBuilder('tag');

    if (query.search) {
      qb.andWhere('(tag.name LIKE :search OR tag.slug LIKE :search)', {
        search: searchPattern(query.search),
      });
    }

    applySorting(qb, 'tag', SORTABLE, query.sort, query.order, 'created_at');

    const [items, total] = await qb.skip(query.skip).take(query.take).getManyAndCount();

    return new Paginated(items, total, query.page, query.limit);
  }

  async findOne(id: number): Promise<Tag> {
    const tag = await this.repository.findOne({ where: { id } });

    if (!tag) {
      throw new NotFoundException('Tag not found.');
    }

    return tag;
  }

  async create(dto: CreateTagDto): Promise<Tag> {
    const tag = this.repository.create({
      name: dto.name,
      slug: await this.resolveSlug(dto.slug, dto.name),
    });

    return this.repository.save(tag);
  }

  async update(id: number, dto: UpdateTagDto): Promise<Tag> {
    const tag = await this.findOne(id);
    const changes: QueryDeepPartialEntity<Tag> = {};

    if (dto.name !== undefined) {
      changes.name = dto.name;
    }

    if (dto.slug !== undefined && dto.slug !== tag.slug) {
      await this.assertSlugAvailable(dto.slug, id);
      changes.slug = dto.slug;
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update(id, changes);
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<null> {
    const tag = await this.findOne(id);

    await this.repository.remove(tag);

    return null;
  }

  private async resolveSlug(slug: string | undefined, name: string): Promise<string> {
    if (slug) {
      await this.assertSlugAvailable(slug);
      return slug;
    }

    return buildUniqueSlug(name, async (candidate) => await this.slugExists(candidate), 80);
  }

  private async assertSlugAvailable(slug: string, excludeId?: number): Promise<void> {
    const qb = this.repository.createQueryBuilder('tag').where('tag.slug = :slug', { slug });

    if (excludeId !== undefined) {
      qb.andWhere('tag.id != :excludeId', { excludeId });
    }

    if (await qb.getExists()) {
      throw new ConflictException('The slug has already been taken.');
    }
  }

  private async slugExists(slug: string): Promise<boolean> {
    return this.repository
      .createQueryBuilder('tag')
      .where('tag.slug = :slug', { slug })
      .getExists();
  }
}
