import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Paginated } from '../common/utils/api-response';
import { applySorting, searchPattern } from '../common/utils/query';
import { CreateCommentDto } from './dto/create-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';

const SORTABLE = {
  id: 'id',
  body: 'body',
  product_id: 'productId',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
} as const;

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private readonly repository: Repository<Comment>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(query: QueryCommentsDto, productId?: number): Promise<Paginated<Comment>> {
    const qb = this.repository.createQueryBuilder('comment');

    if (productId !== undefined) {
      qb.andWhere('comment.productId = :productId', { productId });
    }

    if (query.product_id !== undefined) {
      qb.andWhere('comment.productId = :productId', { productId: query.product_id });
    }

    if (query.search) {
      qb.andWhere('comment.body LIKE :search', { search: searchPattern(query.search) });
    }

    applySorting(qb, 'comment', SORTABLE, query.sort, query.order, 'created_at');

    const [items, total] = await qb.skip(query.skip).take(query.take).getManyAndCount();

    return new Paginated(items, total, query.page, query.limit);
  }

  async create(productId: number, dto: CreateCommentDto, actor: AuthenticatedUser): Promise<Comment> {
    await this.assertProductExists(productId);

    const comment = this.repository.create({
      body: dto.body,
      productId,
      userId: actor.id,
    });

    return this.repository.save(comment);
  }

  async update(id: number, dto: UpdateCommentDto, actor: AuthenticatedUser): Promise<Comment> {
    const comment = await this.findOneOrFail(id);
    this.assertOwnerOrAdmin(comment, actor);

    if (dto.body !== undefined) {
      await this.repository.update(id, { body: dto.body });
    }

    return this.findOneOrFail(id);
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<null> {
    const comment = await this.findOneOrFail(id);
    this.assertOwnerOrAdmin(comment, actor);

    await this.repository.remove(comment);

    return null;
  }

  async assertProductExists(productId: number): Promise<void> {
    const exists = await this.dataSource
      .createQueryBuilder()
      .select('1')
      .from('products', 'p')
      .where('p.id = :productId', { productId })
      .getExists();

    if (!exists) {
      throw new NotFoundException('Product not found');
    }
  }

  private async findOneOrFail(id: number): Promise<Comment> {
    const comment = await this.repository.findOne({ where: { id } });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    return comment;
  }

  private assertOwnerOrAdmin(comment: Comment, actor: AuthenticatedUser): void {
    if (actor.role !== 'admin' && Number(comment.userId) !== actor.id) {
      throw new ForbiddenException('This action is unauthorized');
    }
  }
}
