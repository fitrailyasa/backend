const { Injectable, Inject, NotFoundException, ConflictException } = require('@nestjs/common');
const { InjectRepository } = require('@nestjs/typeorm');
const { ConfigService } = require('@nestjs/config');
const { Brackets, In } = require('typeorm');
const { Product } = require('./entities/product.entity');
const { Category } = require('../categories/entities/category.entity');
const { Tag } = require('../tags/entities/tag.entity');
const { ProductTag } = require('../tags/entities/product-tag.entity');
const { OrderItem } = require('../orders/entities/order-item.entity');
const { ok, paginated } = require('../common/utils/api-response');
const { buildPagination, parseIncludes, resolveSortColumn, searchPattern } = require('../common/utils/query');
const { uniqueSlug } = require('../common/utils/slugify');

const SORTABLE = ['id', 'name', 'slug', 'price', 'stock', 'created_at', 'updated_at'];
const INCLUDES = ['category', 'tags'];

@Injectable()
class ProductsService {
  @InjectRepository(Product)
  productRepository;

  @InjectRepository(Category)
  categoryRepository;

  @InjectRepository(Tag)
  tagRepository;

  @InjectRepository(ProductTag)
  productTagRepository;

  @InjectRepository(OrderItem)
  orderItemRepository;

  @Inject(ConfigService)
  config;

  pagination(query) {
    return buildPagination(query, {
      defaultLimit: this.config.get('PAGINATION_DEFAULT_LIMIT', 10),
      maxLimit: this.config.get('PAGINATION_MAX_LIMIT', 100),
    });
  }

  async slugExists(slug, exceptId) {
    const builder = this.productRepository
      .createQueryBuilder('product')
      .where('product.slug = :slug', { slug });

    if (exceptId) builder.andWhere('product.id != :exceptId', { exceptId: Number(exceptId) });

    return Boolean(await builder.getOne());
  }

  async resolveSlug(name, requestedSlug, exceptId) {
    if (requestedSlug && (await this.slugExists(requestedSlug, exceptId))) {
      throw new ConflictException('Slug has already been taken.');
    }

    return uniqueSlug(requestedSlug || name, (candidate) => this.slugExists(candidate, exceptId));
  }

  async assertCategoryExists(categoryId) {
    const category = await this.categoryRepository.findOne({
      where: { id: Number(categoryId) },
    });

    if (!category) throw new NotFoundException('Category not found.');
  }

  async assertTagsExist(tagIds) {
    const tags = await this.tagRepository.find({ where: { id: In(tagIds.map(Number)) } });

    if (tags.length !== new Set(tagIds.map(String)).size) {
      throw new NotFoundException('One or more tags were not found.');
    }

    return tags;
  }

  async attachTags(productId, tagIds) {
    const ids = [...new Set((tagIds ?? []).map(Number))];
    if (ids.length === 0) return;

    await this.assertTagsExist(ids);
    await this.productTagRepository.save(
      ids.map((tagId) => this.productTagRepository.create({ productId, tagId })),
    );
  }

  async syncTags(productId, tagIds) {
    await this.productTagRepository.delete({ productId: Number(productId) });
    await this.attachTags(productId, tagIds);
  }

  async loadTags(productIds) {
    if (productIds.length === 0) return new Map();

    const rows = await this.productTagRepository.find({
      where: { productId: In(productIds.map(Number)) },
    });

    if (rows.length === 0) return new Map();

    const tags = await this.tagRepository.find({
      where: { id: In(rows.map((row) => Number(row.tagId))) },
    });
    const tagsById = new Map(tags.map((tag) => [String(tag.id), tag]));
    const grouped = new Map();

    for (const row of rows) {
      const productId = String(row.productId);
      const tag = tagsById.get(String(row.tagId));

      if (!tag) continue;

      const list = grouped.get(productId) ?? [];
      list.push(tag);
      grouped.set(productId, list);
    }

    return grouped;
  }

  async findAll(query) {
    const pagination = this.pagination(query);
    const includes = parseIncludes(query.include, INCLUDES);
    const builder = this.productRepository.createQueryBuilder('product');

    if (includes.includes('category')) {
      builder.leftJoinAndSelect('product.category', 'category');
    }

    if (query.category_id !== undefined) {
      builder.andWhere('product.categoryId = :categoryId', { categoryId: Number(query.category_id) });
    }

    if (query.min_price !== undefined) {
      builder.andWhere('product.price >= :minPrice', { minPrice: query.min_price });
    }

    if (query.max_price !== undefined) {
      builder.andWhere('product.price <= :maxPrice', { maxPrice: query.max_price });
    }

    if (query.tag_id !== undefined) {
      builder.andWhere(
        `(SELECT COUNT(*) FROM product_tag pt WHERE pt.product_id = product.id AND pt.tag_id = :tagId) > 0`,
        { tagId: Number(query.tag_id) },
      );
    }

    if (query.tag !== undefined) {
      builder.andWhere(
        `(SELECT COUNT(*) FROM product_tag pt
            INNER JOIN tags t ON t.id = pt.tag_id
          WHERE pt.product_id = product.id AND t.slug = :tagSlug) > 0`,
        { tagSlug: query.tag },
      );
    }

    if (pagination.search) {
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('product.name LIKE :search', { search: searchPattern(pagination.search) })
            .orWhere('product.slug LIKE :search', { search: searchPattern(pagination.search) })
            .orWhere('product.description LIKE :search', { search: searchPattern(pagination.search) });
        }),
      );
    }

    const sort = resolveSortColumn(pagination.sort, SORTABLE);

    builder.orderBy(`product.${sort}`, pagination.order).skip(pagination.skip).take(pagination.take);

    const [items, total] = await builder.getManyAndCount();

    if (includes.includes('tags')) {
      const grouped = await this.loadTags(items.map((item) => item.id));
      items.forEach((item) => {
        item.tags = grouped.get(String(item.id)) ?? [];
      });
    }

    return paginated(items, total, pagination, 'Products retrieved');
  }

  async findOneOrFail(id, query = {}) {
    const includes = parseIncludes(query.include, INCLUDES);
    const builder = this.productRepository
      .createQueryBuilder('product')
      .where('product.id = :id', { id: Number(id) });

    if (includes.includes('category')) {
      builder.leftJoinAndSelect('product.category', 'category');
    }

    const product = await builder.getOne();

    if (!product) throw new NotFoundException('Product not found');

    if (includes.includes('tags')) {
      const grouped = await this.loadTags([product.id]);
      product.tags = grouped.get(String(product.id)) ?? [];
    }

    return product;
  }

  async findOne(id, query) {
    return ok(await this.findOneOrFail(id, query), 'Product retrieved');
  }

  async create(payload) {
    await this.assertCategoryExists(payload.category_id);

    const slug = await this.resolveSlug(payload.name, payload.slug);

    const product = this.productRepository.create({
      categoryId: Number(payload.category_id),
      name: payload.name,
      slug,
      description: payload.description ?? null,
      price: payload.price,
      stock: payload.stock ?? 0,
    });

    const saved = await this.productRepository.save(product);

    await this.attachTags(saved.id, payload.tag_ids);

    return ok(await this.findOneOrFail(saved.id), 'Product created successfully');
  }

  async update(id, payload) {
    const product = await this.findOneOrFail(id);

    if (payload.category_id !== undefined) {
      await this.assertCategoryExists(payload.category_id);
      product.categoryId = Number(payload.category_id);
    }

    if (payload.name !== undefined || payload.slug !== undefined) {
      product.name = payload.name ?? product.name;
      product.slug = await this.resolveSlug(product.name, payload.slug, id);
    }

    if (payload.description !== undefined) product.description = payload.description;
    if (payload.price !== undefined) product.price = payload.price;
    if (payload.stock !== undefined) product.stock = payload.stock;

    await this.productRepository.save(product);

    if (payload.tag_ids !== undefined) {
      await this.syncTags(product.id, payload.tag_ids);
    }

    return ok(await this.findOneOrFail(id), 'Product updated successfully');
  }

  async remove(id) {
    const product = await this.findOneOrFail(id);
    const referenced = await this.orderItemRepository.count({ where: { productId: product.id } });

    if (referenced > 0) {
      throw new ConflictException('Product cannot be deleted while it is referenced by an order.');
    }

    await this.productRepository.remove(product);

    return ok(null, 'Product deleted successfully');
  }
}

module.exports = { ProductsService, SORTABLE };
