import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Paginated } from '../common/utils/api-response';
import { applySorting, parseInclude, searchPattern } from '../common/utils/query';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order, OrderStatus } from './entities/order.entity';

export const ORDER_INCLUDES = ['items', 'items.product', 'user'] as const;

const SORTABLE = {
  id: 'id',
  status: 'status',
  total: 'total',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
} as const;

type LockedProductRow = { id: number; name: string; price: number | string; stock: number };

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly repository: Repository<Order>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(query: QueryOrdersDto, actor: AuthenticatedUser): Promise<Paginated<Order>> {
    const include = parseInclude(query.include, ORDER_INCLUDES);
    const qb = this.repository.createQueryBuilder('order');

    if (actor.role !== 'admin') {
      qb.andWhere('order.userId = :ownerId', { ownerId: actor.id });
    } else if (query.user_id !== undefined) {
      qb.andWhere('order.userId = :ownerId', { ownerId: query.user_id });
    }

    if (query.status !== undefined) {
      qb.andWhere('order.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('CAST(order.id AS CHAR) LIKE :search', { search: searchPattern(query.search) });
    }

    this.applyIncludes(qb, include);
    applySorting(qb, 'order', SORTABLE, query.sort, query.order, 'created_at');

    const [items, total] = await qb.skip(query.skip).take(query.take).getManyAndCount();

    return new Paginated(items, total, query.page, query.limit);
  }

  async findOne(id: number, actor: AuthenticatedUser, include?: string): Promise<Order> {
    const order = await this.getOneOrFail(id, include);

    this.assertOwnerOrAdmin(order, actor);

    return order;
  }

  async create(dto: CreateOrderDto, actor: AuthenticatedUser): Promise<Order> {
    const items = this.mergeDuplicateItems(dto.items);
    const productIds = items.map((item) => item.product_id);
    const orderId = await this.dataSource.transaction(async (manager) => {
      const productsQuery = manager
        .getRepository('products')
        .createQueryBuilder('product')
        .where('product.id IN (:...productIds)', { productIds });

      if (this.dataSource.options.type !== 'better-sqlite3') {
        productsQuery.setLock('pessimistic_write');
      }

      const products = (await productsQuery.getMany()) as unknown as LockedProductRow[];

      const productsById = new Map(products.map((product) => [Number(product.id), product]));

      for (const item of items) {
        const product = productsById.get(item.product_id);

        if (!product) {
          throw new NotFoundException(`Product ${item.product_id} not found.`);
        }

        if (Number(product.stock) < item.quantity) {
          throw new UnprocessableEntityException({
            message: 'Validation failed',
            errors: {
              items: [`Insufficient stock for product "${product.name}".`],
            },
          });
        }
      }

      const total = this.round2(
        items.reduce((sum, item) => {
          const product = productsById.get(item.product_id);

          return sum + Number(product?.price ?? 0) * item.quantity;
        }, 0),
      );

      const orderRepository = manager.getRepository('orders');
      const order = orderRepository.create({
        userId: actor.id,
        status: OrderStatus.PENDING,
        total,
      });
      const savedOrder = await orderRepository.save(order);

      await manager
        .createQueryBuilder()
        .insert()
        .into('order_items')
        .values(
          items.map((item) => ({
            orderId: savedOrder.id,
            productId: item.product_id,
            quantity: item.quantity,
            price: productsById.get(item.product_id)?.price ?? 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        )
        .execute();

      for (const item of items) {
        await manager
          .createQueryBuilder()
          .update('products')
          .set({ stock: () => `stock - ${item.quantity}` })
          .where('id = :productId', { productId: item.product_id })
          .execute();
      }

      return savedOrder.id as number;
    });

    return this.findOne(orderId, actor, 'items,items.product');
  }

  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    actor: AuthenticatedUser,
  ): Promise<Order> {
    const order = await this.findOne(id, actor);

    if (actor.role !== 'admin') {
      const isCancellable =
        order.status === OrderStatus.PENDING && dto.status === OrderStatus.CANCELLED;

      if (!isCancellable) {
        throw new ForbiddenException('You can only cancel your own pending order.');
      }
    }

    await this.repository.update(id, { status: dto.status });

    return this.findOne(id, actor, 'items,items.product');
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<null> {
    const order = await this.findOne(id, actor);

    await this.repository.remove(order);

    return null;
  }

  private applyIncludes(qb: SelectQueryBuilder<Order>, include: readonly string[]): void {
    if (include.includes('items') || include.includes('items.product')) {
      qb.leftJoinAndSelect('order.items', 'item');
    }

    if (include.includes('items.product')) {
      qb.leftJoinAndSelect('item.product', 'product');
    }

    if (include.includes('user')) {
      qb.leftJoinAndSelect('order.user', 'user');
    }
  }

  private async getOneOrFail(id: number, include?: string): Promise<Order> {
    const include_ = parseInclude(include, ORDER_INCLUDES);
    const qb = this.repository.createQueryBuilder('order').where('order.id = :id', { id });

    this.applyIncludes(qb, include_);

    const order = await qb.getOne();

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return order;
  }

  private assertOwnerOrAdmin(order: Order, actor: AuthenticatedUser): void {
    if (actor.role !== 'admin' && Number(order.userId) !== actor.id) {
      throw new ForbiddenException('This action is unauthorized');
    }
  }

  private mergeDuplicateItems(items: CreateOrderItemDto[]): CreateOrderItemDto[] {
    const quantities = new Map<number, number>();

    for (const item of items) {
      quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
    }

    return [...quantities.entries()].map(([product_id, quantity]) => ({ product_id, quantity }));
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
