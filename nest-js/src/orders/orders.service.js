const {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  ConflictException,
} = require('@nestjs/common');
const { InjectRepository, InjectDataSource } = require('@nestjs/typeorm');
const { ConfigService } = require('@nestjs/config');
const { Order } = require('./entities/order.entity');
const { OrderItem } = require('./entities/order-item.entity');
const { Product } = require('../products/entities/product.entity');
const { ok, paginated } = require('../common/utils/api-response');
const { buildPagination, parseIncludes, resolveSortColumn } = require('../common/utils/query');

const SORTABLE = ['id', 'status', 'total', 'created_at', 'updated_at'];
const INCLUDES = ['items', 'items.product', 'user'];
const OWNER_CANCELLABLE = ['pending'];

@Injectable()
class OrdersService {
  @InjectRepository(Order)
  orderRepository;

  @InjectRepository(OrderItem)
  orderItemRepository;

  @InjectRepository(Product)
  productRepository;

  @InjectDataSource()
  dataSource;

  @Inject(ConfigService)
  config;

  pagination(query) {
    return buildPagination(query, {
      defaultLimit: this.config.get('PAGINATION_DEFAULT_LIMIT', 10),
      maxLimit: this.config.get('PAGINATION_MAX_LIMIT', 100),
    });
  }

  supportsRowLocks() {
    return this.dataSource.options.type !== 'better-sqlite3';
  }

  applyIncludes(builder, includes) {
    if (includes.includes('user')) builder.leftJoinAndSelect('order.user', 'user');
    if (includes.includes('items')) builder.leftJoinAndSelect('order.items', 'items');
    if (includes.includes('items.product')) {
      builder.leftJoinAndSelect('items.product', 'itemsProduct');
    }
  }

  async findAll(query, currentUser) {
    const pagination = this.pagination(query);
    const includes = parseIncludes(query.include, INCLUDES);
    const builder = this.orderRepository.createQueryBuilder('order');

    if (includes.includes('items') || includes.includes('items.product')) {
      includes.push('items');
    }

    this.applyIncludes(builder, includes);

    if (currentUser.role !== 'admin') {
      builder.andWhere('order.userId = :userId', { userId: Number(currentUser.id) });
    } else if (query.user_id !== undefined) {
      builder.andWhere('order.userId = :userId', { userId: Number(query.user_id) });
    }

    if (query.status !== undefined) {
      builder.andWhere('order.status = :status', { status: query.status });
    }

    const sort = resolveSortColumn(pagination.sort, SORTABLE);

    builder.orderBy(`order.${sort}`, pagination.order).skip(pagination.skip).take(pagination.take);

    const [items, total] = await builder.getManyAndCount();

    return paginated(items, total, pagination, 'Orders retrieved');
  }

  async findOneOrFail(id, query = {}) {
    const includes = parseIncludes(query.include, INCLUDES);
    const builder = this.orderRepository
      .createQueryBuilder('order')
      .where('order.id = :id', { id: Number(id) });

    if (includes.includes('items') || includes.includes('items.product')) {
      includes.push('items');
    }

    this.applyIncludes(builder, includes);

    const order = await builder.getOne();

    if (!order) throw new NotFoundException('Order not found.');

    return order;
  }

  assertOwnership(order, currentUser) {
    if (String(order.userId) !== String(currentUser.id) && currentUser.role !== 'admin') {
      throw new ForbiddenException('You are not allowed to access this order.');
    }
  }

  async findOne(id, currentUser, query = {}) {
    const order = await this.findOneOrFail(id, query);

    this.assertOwnership(order, currentUser);

    return ok(order, 'Order retrieved');
  }

  /**
   * The client only sends product ids and quantities: prices are snapshotted from the
   * products table and the total is computed server side, inside a single transaction
   * that also decrements the stock.
   */
  async create(payload, currentUser) {
    const quantities = new Map();

    for (const item of payload.items) {
      const productId = Number(item.product_id);
      quantities.set(productId, (quantities.get(productId) ?? 0) + Number(item.quantity));
    }

    const productIds = [...quantities.keys()];

    const created = await this.dataSource.transaction(async (manager) => {
      const productsQuery = manager
        .createQueryBuilder(Product, 'product')
        .where('product.id IN (:...productIds)', { productIds });

      if (this.supportsRowLocks()) productsQuery.setLock('pessimistic_write');

      const products = await productsQuery.getMany();

      if (products.length !== productIds.length) {
        throw new NotFoundException('One or more products were not found.');
      }

      const items = [...quantities.entries()].map(([productId, quantity]) => {
        const product = products.find((candidate) => String(candidate.id) === String(productId));

        if (product.stock < quantity) {
          throw new UnprocessableEntityException({
            message: 'Validation failed',
            errors: { items: [`Insufficient stock for product "${product.name}".`] },
          });
        }

        return {
          product,
          quantity,
          price: Number(product.price),
        };
      });

      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const order = manager.create(Order, {
        userId: Number(currentUser.id),
        status: 'pending',
        total: Number(total.toFixed(2)),
      });
      await manager.save(order);

      const orderItems = items.map((item) =>
        manager.create(OrderItem, {
          orderId: order.id,
          productId: item.product.id,
          quantity: item.quantity,
          price: item.price,
        }),
      );

      await manager.save(orderItems);

      for (const item of items) {
        await manager
          .createQueryBuilder()
          .update(Product)
          .set({ stock: () => `stock - ${item.quantity}` })
          .where('id = :id', { id: item.product.id })
          .execute();
      }

      return manager.findOne(Order, { where: { id: order.id } });
    });

    return ok(created, 'Order created successfully');
  }

  async updateStatus(id, payload, currentUser) {
    const order = await this.findOneOrFail(id);
    const isOwner = String(order.userId) === String(currentUser.id);
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You are not allowed to update this order.');
    }

    if (!isAdmin) {
      if (!OWNER_CANCELLABLE.includes(order.status)) {
        throw new ForbiddenException('Only pending orders can be cancelled by the owner.');
      }

      if (payload.status !== 'cancelled') {
        throw new ForbiddenException('Only pending orders can be cancelled by the owner.');
      }
    }

    if (payload.status === order.status) {
      throw new ConflictException(`Order is already ${order.status}.`);
    }

    order.status = payload.status;

    return ok(await this.orderRepository.save(order), 'Order status updated successfully');
  }

  async remove(id) {
    const order = await this.findOneOrFail(id);

    await this.orderItemRepository.delete({ orderId: order.id });
    await this.orderRepository.remove(order);

    return ok(null, 'Order deleted successfully');
  }
}

module.exports = { OrdersService, SORTABLE };
