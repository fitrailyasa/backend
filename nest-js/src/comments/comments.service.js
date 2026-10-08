const { Injectable, Inject, NotFoundException, ForbiddenException } = require('@nestjs/common');
const { InjectRepository } = require('@nestjs/typeorm');
const { ConfigService } = require('@nestjs/config');
const { Comment } = require('./entities/comment.entity');
const { Product } = require('../products/entities/product.entity');
const { ok, paginated } = require('../common/utils/api-response');
const { buildPagination, resolveSortColumn, searchPattern } = require('../common/utils/query');

const SORTABLE = ['id', 'body', 'created_at', 'updated_at'];

@Injectable()
class CommentsService {
  @InjectRepository(Comment)
  commentRepository;

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

  async findAll(query, productId) {
    const scopedProductId = productId ?? query.product_id;

    if (scopedProductId !== undefined) {
      const product = await this.productRepository.findOne({ where: { id: Number(scopedProductId) } });
      if (!product) throw new NotFoundException('Product not found');
    }

    const pagination = this.pagination(query);
    const builder = this.commentRepository.createQueryBuilder('comment');

    if (scopedProductId !== undefined) {
      builder.where('comment.productId = :productId', { productId: Number(scopedProductId) });
    }

    if (query.user_id !== undefined) {
      builder.andWhere('comment.userId = :userId', { userId: Number(query.user_id) });
    }

    if (pagination.search) {
      builder.andWhere('comment.body LIKE :search', { search: searchPattern(pagination.search) });
    }

    const sort = resolveSortColumn(pagination.sort, SORTABLE);

    builder.orderBy(`comment.${sort}`, pagination.order).skip(pagination.skip).take(pagination.take);

    const [items, total] = await builder.getManyAndCount();

    return paginated(items, total, pagination, 'Comments retrieved');
  }

  async findOneOrFail(id) {
    const comment = await this.commentRepository.findOne({ where: { id: Number(id) } });

    if (!comment) throw new NotFoundException('Comment not found.');

    return comment;
  }

  assertOwnership(comment, currentUser) {
    if (String(comment.userId) !== String(currentUser.id) && currentUser.role !== 'admin') {
      throw new ForbiddenException('You are not allowed to modify this comment.');
    }
  }

  async create(productId, payload, currentUser) {
    const product = await this.productRepository.findOne({ where: { id: Number(productId) } });

    if (!product) throw new NotFoundException('Product not found');

    const comment = this.commentRepository.create({
      productId: product.id,
      userId: Number(currentUser.id),
      body: payload.body,
    });

    return ok(await this.commentRepository.save(comment), 'Comment created successfully');
  }

  async update(id, payload, currentUser) {
    const comment = await this.findOneOrFail(id);

    this.assertOwnership(comment, currentUser);

    comment.body = payload.body ?? comment.body;

    return ok(await this.commentRepository.save(comment), 'Comment updated successfully');
  }

  async remove(id, currentUser) {
    const comment = await this.findOneOrFail(id);

    this.assertOwnership(comment, currentUser);
    await this.commentRepository.remove(comment);

    return ok(null, 'Comment deleted successfully');
  }
}

module.exports = { CommentsService, SORTABLE };
