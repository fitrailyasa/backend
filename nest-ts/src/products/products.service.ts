import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryDeepPartialEntity, Repository } from 'typeorm';
import { Tag } from '../tags/entities/tag.entity';
import { Paginated } from '../common/utils/api-response';
import { applySorting, parseInclude, searchPattern } from '../common/utils/query';
import { buildUniqueSlug } from '../common/utils/slugify';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, TagRef } from './entities/product.entity';

export const PRODUCT_INCLUDES = ['category', 'tags'] as const;

const SORTABLE = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  price: 'price',
  stock: 'stock',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
} as const;

type ProductTagRow = { product_id: number; tag_id: number };

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly repository: Repository<Product>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(query: QueryProductsDto): Promise<Paginated<Product>> {
    const include = parseInclude(query.include, PRODUCT_INCLUDES);
    const qb = this.repository.createQueryBuilder('product');

    if (include.includes('category')) {
      qb.leftJoinAndSelect('product.category', 'category');
    }

    if (query.search) {
      qb.andWhere(
        '(product.name LIKE :search OR product.slug LIKE :search OR product.description LIKE :search)',
        { search: searchPattern(query.search) },
      );
    }

    if (query.category_id !== undefined) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId: query.category_id });
    }

    if (query.tag_id !== undefined) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_tag pt WHERE pt.product_id = product.id AND pt.tag_id = :tagId)',
        { tagId: query.tag_id },
      );
    }

    if (query.tag !== undefined) {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM product_tag pt2
           INNER JOIN tags t ON t.id = pt2.tag_id
           WHERE pt2.product_id = product.id AND t.slug = :tagSlug
         )`,
        { tagSlug: query.tag },
      );
    }

    if (query.min_price !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: query.min_price });
    }

    if (query.max_price !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: query.max_price });
    }

    applySorting(qb, 'product', SORTABLE, query.sort, query.order, 'created_at');

    const [items, total] = await qb.skip(query.skip).take(query.take).getManyAndCount();

    if (include.includes('tags')) {
      await this.attachTags(items);
    }

    return new Paginated(items, total, query.page, query.limit);
  }

  async findOne(id: number, include: string | undefined = undefined): Promise<Product> {
    const includes = parseInclude(include, PRODUCT_INCLUDES);
    const qb = this.repository.createQueryBuilder('product').where('product.id = :id', { id });

    if (includes.includes('category')) {
      qb.leftJoinAndSelect('product.category', 'category');
    }

    const product = await qb.getOne();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (includes.includes('tags')) {
      await this.attachTags([product]);
    }

    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    await this.assertCategoryExists(dto.category_id);
    await this.assertTagsExist(dto.tag_ids);

    const product = this.repository.create({
      name: dto.name,
      description: dto.description ?? null,
      categoryId: dto.category_id,
      price: dto.price,
      stock: dto.stock ?? 0,
      slug: await this.resolveSlug(dto.slug, dto.name),
    });

    const saved = await this.repository.save(product);
    await this.syncTags(saved.id, dto.tag_ids);

    return saved;
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    const changes: QueryDeepPartialEntity<Product> = {};

    if (dto.category_id !== undefined && dto.category_id !== product.categoryId) {
      await this.assertCategoryExists(dto.category_id);
      changes.categoryId = dto.category_id;
    }

    if (dto.tag_ids !== undefined) {
      await this.assertTagsExist(dto.tag_ids);
    }

    if (dto.name !== undefined) {
      changes.name = dto.name;
    }

    if (dto.description !== undefined) {
      changes.description = dto.description;
    }

    if (dto.price !== undefined) {
      changes.price = dto.price;
    }

    if (dto.stock !== undefined) {
      changes.stock = dto.stock;
    }

    if (dto.slug !== undefined && dto.slug !== product.slug) {
      await this.assertSlugAvailable(dto.slug, id);
      changes.slug = dto.slug;
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update(id, changes);
    }

    if (dto.tag_ids !== undefined) {
      await this.syncTags(id, dto.tag_ids);
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<null> {
    const product = await this.findOne(id);
    const ordered = await this.dataSource
      .createQueryBuilder()
      .select('1')
      .from('order_items', 'oi')
      .where('oi.product_id = :id', { id })
      .getExists();

    if (ordered) {
      throw new ConflictException('The product is referenced by an order and cannot be deleted.');
    }

    await this.repository.remove(product);

    return null;
  }

  private async attachTags(products: Product[]): Promise<void> {
    if (products.length === 0) {
      return;
    }

    const rows = await this.dataSource
      .createQueryBuilder()
      .select('pt.product_id', 'product_id')
      .addSelect('pt.tag_id', 'tag_id')
      .from('product_tag', 'pt')
      .where('pt.product_id IN (:...productIds)', { productIds: products.map((item) => item.id) })
      .getRawMany<ProductTagRow>();

    const tags = rows.length
      ? await this.dataSource.getRepository(Tag).find({
          where: { id: In(rows.map((row) => Number(row.tag_id))) },
        })
      : [];
    const tagsById = new Map(tags.map((tag) => [Number(tag.id), tag]));
    const grouped = new Map<number, TagRef[]>();

    for (const row of rows) {
      const tag = tagsById.get(Number(row.tag_id));
      if (!tag) continue;

      const productId = Number(row.product_id);
      const list = grouped.get(productId) ?? [];
      list.push({
        id: Number(tag.id),
        name: tag.name,
        slug: tag.slug,
        created_at: tag.createdAt,
        updated_at: tag.updatedAt,
      });
      grouped.set(productId, list);
    }

    for (const product of products) {
      const list = grouped.get(product.id) ?? [];
      list.sort((left, right) => left.name.localeCompare(right.name));
      product.tags = list;
    }
  }

  private async syncTags(productId: number, tagIds: number[] | undefined): Promise<void> {
    const uniqueTagIds = [...new Set(tagIds ?? [])];

    if (tagIds === undefined) {
      return;
    }

    await this.dataSource
      .createQueryBuilder()
      .delete()
      .from('product_tag')
      .where('product_id = :productId', { productId })
      .execute();

    if (uniqueTagIds.length === 0) {
      return;
    }

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('product_tag')
      .values(uniqueTagIds.map((tagId) => ({ productId, tagId })))
      .execute();
  }

  private async assertCategoryExists(categoryId: number): Promise<void> {
    const exists = await this.dataSource
      .createQueryBuilder()
      .select('1')
      .from('categories', 'c')
      .where('c.id = :categoryId', { categoryId })
      .getExists();

    if (!exists) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        errors: { category_id: ['The selected category does not exist.'] },
      });
    }
  }

  private async assertTagsExist(tagIds: number[] | undefined): Promise<void> {
    if (!tagIds || tagIds.length === 0) {
      return;
    }

    const uniqueTagIds = [...new Set(tagIds)];
    const found = await this.dataSource
      .createQueryBuilder()
      .select('t.id', 'id')
      .from('tags', 't')
      .where('t.id IN (:...tagIds)', { tagIds: uniqueTagIds })
      .getRawMany<{ id: number }>();

    if (found.length !== uniqueTagIds.length) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        errors: { tag_ids: ['One or more of the selected tags do not exist.'] },
      });
    }
  }

  private async resolveSlug(slug: string | undefined, name: string): Promise<string> {
    if (slug) {
      await this.assertSlugAvailable(slug);
      return slug;
    }

    return buildUniqueSlug(name, async (candidate) => await this.slugExists(candidate), 180);
  }

  private async assertSlugAvailable(slug: string, excludeId?: number): Promise<void> {
    const qb = this.repository.createQueryBuilder('product').where('product.slug = :slug', { slug });

    if (excludeId !== undefined) {
      qb.andWhere('product.id != :excludeId', { excludeId });
    }

    if (await qb.getExists()) {
      throw new ConflictException('The slug has already been taken.');
    }
  }

  private async slugExists(slug: string): Promise<boolean> {
    return this.repository
      .createQueryBuilder('product')
      .where('product.slug = :slug', { slug })
      .getExists();
  }
}
