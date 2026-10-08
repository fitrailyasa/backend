const { Injectable, Inject, NotFoundException, ConflictException } = require('@nestjs/common');
const { InjectRepository } = require('@nestjs/typeorm');
const { ConfigService } = require('@nestjs/config');
const { Brackets } = require('typeorm');
const { Category } = require('./entities/category.entity');
const { Product } = require('../products/entities/product.entity');
const { ok, paginated } = require('../common/utils/api-response');
const { buildPagination, parseIncludes, resolveSortColumn, searchPattern } = require('../common/utils/query');
const { uniqueSlug } = require('../common/utils/slugify');

const SORTABLE = ['id', 'name', 'slug', 'created_at', 'updated_at'];
const INCLUDES = ['products'];

@Injectable()
class CategoriesService {
  @InjectRepository(Category)
  categoryRepository;

  @InjectRepository(Product)
  productRepository;

  @Inject(ConfigService)
  config;

  pagination(query) {
    return buildPagination(query, {
      defaultLimit: this.config.get('PAGINATION_DEFAULT_LIMIT', 10),
      maxLimit: this.config.get('PAGINATION_MAX_LIMIT', 100),
    });
  }

  async slugExists(slug, exceptId) {
    const builder = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.slug = :slug', { slug });

    if (exceptId) builder.andWhere('category.id != :exceptId', { exceptId: Number(exceptId) });

    return Boolean(await builder.getOne());
  }

  async resolveSlug(name, requestedSlug, exceptId) {
    if (requestedSlug && (await this.slugExists(requestedSlug, exceptId))) {
      throw new ConflictException('Slug has already been taken.');
    }

    return uniqueSlug(requestedSlug || name, (candidate) => this.slugExists(candidate, exceptId));
  }

  async findAll(query) {
    const pagination = this.pagination(query);
    const includes = parseIncludes(query.include, INCLUDES);
    const builder = this.categoryRepository.createQueryBuilder('category');

    if (includes.includes('products')) {
      builder.leftJoinAndSelect('category.products', 'products');
    }

    if (pagination.search) {
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('category.name LIKE :search', { search: searchPattern(pagination.search) })
            .orWhere('category.slug LIKE :search', { search: searchPattern(pagination.search) });
        }),
      );
    }

    const sort = resolveSortColumn(pagination.sort, SORTABLE);

    builder.orderBy(`category.${sort}`, pagination.order).skip(pagination.skip).take(pagination.take);

    const [items, total] = await builder.getManyAndCount();

    return paginated(items, total, pagination, 'Categories retrieved');
  }

  async findOneOrFail(id, query = {}) {
    const includes = parseIncludes(query.include, INCLUDES);
    const builder = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.id = :id', { id: Number(id) });

    if (includes.includes('products')) {
      builder.leftJoinAndSelect('category.products', 'products');
    }

    const category = await builder.getOne();

    if (!category) throw new NotFoundException('Category not found.');

    return category;
  }

  async findOne(id, query) {
    return ok(await this.findOneOrFail(id, query), 'Category retrieved');
  }

  async create(payload) {
    const slug = await this.resolveSlug(payload.name, payload.slug);

    const category = this.categoryRepository.create({
      name: payload.name,
      slug,
      description: payload.description ?? null,
    });

    return ok(await this.categoryRepository.save(category), 'Category created successfully');
  }

  async update(id, payload) {
    const category = await this.findOneOrFail(id);
    const name = payload.name ?? category.name;
    const slug = await this.resolveSlug(name, payload.slug, id);

    category.name = name;
    category.slug = slug;

    if (payload.description !== undefined) category.description = payload.description;

    return ok(await this.categoryRepository.save(category), 'Category updated successfully');
  }

  async remove(id) {
    const category = await this.findOneOrFail(id);
    const productCount = await this.productRepository.count({ where: { categoryId: category.id } });

    if (productCount > 0) {
      throw new ConflictException('Category cannot be deleted while it still has products.');
    }

    await this.categoryRepository.remove(category);

    return ok(null, 'Category deleted successfully');
  }
}

module.exports = { CategoriesService, SORTABLE };
