const { Injectable, Inject, NotFoundException, ConflictException } = require('@nestjs/common');
const { InjectRepository } = require('@nestjs/typeorm');
const { ConfigService } = require('@nestjs/config');
const { Brackets } = require('typeorm');
const { Tag } = require('./entities/tag.entity');
const { ProductTag } = require('./entities/product-tag.entity');
const { ok, paginated } = require('../common/utils/api-response');
const { buildPagination, resolveSortColumn, searchPattern } = require('../common/utils/query');
const { uniqueSlug } = require('../common/utils/slugify');

const SORTABLE = ['id', 'name', 'slug', 'created_at', 'updated_at'];

@Injectable()
class TagsService {
  @InjectRepository(Tag)
  tagRepository;

  @InjectRepository(ProductTag)
  productTagRepository;

  @Inject(ConfigService)
  config;

  pagination(query) {
    return buildPagination(query, {
      defaultLimit: this.config.get('PAGINATION_DEFAULT_LIMIT', 10),
      maxLimit: this.config.get('PAGINATION_MAX_LIMIT', 100),
    });
  }

  async slugExists(slug, exceptId) {
    const builder = this.tagRepository.createQueryBuilder('tag').where('tag.slug = :slug', { slug });

    if (exceptId) builder.andWhere('tag.id != :exceptId', { exceptId: Number(exceptId) });

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
    const builder = this.tagRepository.createQueryBuilder('tag');

    if (pagination.search) {
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('tag.name LIKE :search', { search: searchPattern(pagination.search) })
            .orWhere('tag.slug LIKE :search', { search: searchPattern(pagination.search) });
        }),
      );
    }

    const sort = resolveSortColumn(pagination.sort, SORTABLE);

    builder.orderBy(`tag.${sort}`, pagination.order).skip(pagination.skip).take(pagination.take);

    const [items, total] = await builder.getManyAndCount();

    return paginated(items, total, pagination, 'Tags retrieved');
  }

  async findOneOrFail(id) {
    const tag = await this.tagRepository.findOne({ where: { id: Number(id) } });

    if (!tag) throw new NotFoundException('Tag not found.');

    return tag;
  }

  async findOne(id) {
    return ok(await this.findOneOrFail(id), 'Tag retrieved');
  }

  async create(payload) {
    const slug = await this.resolveSlug(payload.name, payload.slug);

    const tag = this.tagRepository.create({ name: payload.name, slug });

    return ok(await this.tagRepository.save(tag), 'Tag created successfully');
  }

  async update(id, payload) {
    const tag = await this.findOneOrFail(id);
    const name = payload.name ?? tag.name;
    const slug = await this.resolveSlug(name, payload.slug, id);

    tag.name = name;
    tag.slug = slug;

    return ok(await this.tagRepository.save(tag), 'Tag updated successfully');
  }

  async remove(id) {
    const tag = await this.findOneOrFail(id);

    await this.productTagRepository.delete({ tagId: tag.id });
    await this.tagRepository.remove(tag);

    return ok(null, 'Tag deleted successfully');
  }
}

module.exports = { TagsService, SORTABLE };
