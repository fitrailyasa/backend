import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, QueryDeepPartialEntity, Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { applySorting, parseInclude, searchPattern } from '../common/utils/query';
import { Paginated } from '../common/utils/api-response';
import { buildUniqueSlug } from '../common/utils/slugify';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

export const CATEGORY_INCLUDES = ['products'] as const;

const SORTABLE = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
} as const;

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly repository: Repository<Category>,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<Paginated<Category>> {
    const include = parseInclude(query.include, CATEGORY_INCLUDES);
    const qb = this.repository.createQueryBuilder('category');

    if (include.includes('products')) {
      qb.leftJoinAndSelect('category.products', 'product');
    }

    if (query.search) {
      qb.andWhere('(category.name LIKE :search OR category.slug LIKE :search)', {
        search: searchPattern(query.search),
      });
    }

    applySorting(qb, 'category', SORTABLE, query.sort, query.order, 'created_at');

    const [items, total] = await qb.skip(query.skip).take(query.take).getManyAndCount();

    return new Paginated(items, total, query.page, query.limit);
  }

  async findOne(id: number, include: string | undefined = undefined): Promise<Category> {
    const relations: FindOptionsRelations<Category> = {};
    const includes = parseInclude(include, CATEGORY_INCLUDES);

    if (includes.includes('products')) {
      relations.products = true;
    }

    const category = await this.repository.findOne({ where: { id }, relations });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const category = this.repository.create({
      name: dto.name,
      description: dto.description ?? null,
      slug: await this.resolveSlug(dto.slug, dto.name),
    });

    return this.repository.save(category);
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    const changes: QueryDeepPartialEntity<Category> = {};

    if (dto.name !== undefined) {
      changes.name = dto.name;
    }

    if (dto.description !== undefined) {
      changes.description = dto.description;
    }

    if (dto.slug !== undefined && dto.slug !== category.slug) {
      await this.assertSlugAvailable(dto.slug, id);
      changes.slug = dto.slug;
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update(id, changes);
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<null> {
    const category = await this.findOne(id);
    const hasProducts = await this.repository
      .createQueryBuilder('category')
      .innerJoin('category.products', 'product')
      .where('category.id = :id', { id })
      .getExists();

    if (hasProducts) {
      throw new ConflictException('The category still has products and cannot be deleted.');
    }

    await this.repository.remove(category);

    return null;
  }

  private async resolveSlug(slug: string | undefined, name: string): Promise<string> {
    if (slug) {
      await this.assertSlugAvailable(slug);
      return slug;
    }

    return buildUniqueSlug(name, async (candidate) => await this.slugExists(candidate));
  }

  private async assertSlugAvailable(slug: string, excludeId?: number): Promise<void> {
    const qb = this.repository.createQueryBuilder('category').where('category.slug = :slug', { slug });

    if (excludeId !== undefined) {
      qb.andWhere('category.id != :excludeId', { excludeId });
    }

    if (await qb.getExists()) {
      throw new ConflictException('The slug has already been taken.');
    }
  }

  private async slugExists(slug: string): Promise<boolean> {
    return this.repository
      .createQueryBuilder('category')
      .where('category.slug = :slug', { slug })
      .getExists();
  }
}
