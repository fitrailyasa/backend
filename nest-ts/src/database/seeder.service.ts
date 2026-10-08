import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { hashPassword } from '../common/utils/password';
import { slugify } from '../common/utils/slugify';
import { OrderStatus } from '../orders/entities/order.entity';

const SEED_PASSWORD = 'password';

const USERS = [
  { name: 'Admin', email: 'admin@example.com', role: 'admin' },
  { name: 'User', email: 'user@example.com', role: 'user' },
  { name: 'User 2', email: 'user2@example.com', role: 'user' },
  { name: 'User 3', email: 'user3@example.com', role: 'user' },
  { name: 'User 4', email: 'user4@example.com', role: 'user' },
];

const CATEGORIES = [
  { name: 'Electronics', description: 'Phones, tablets, cameras, and other electronics.' },
  { name: 'Computers', description: 'Laptops, desktops, monitors, and peripherals.' },
  { name: 'Accessories', description: 'Keyboards, mice, headsets, and other accessories.' },
];

const TAGS = ['promo', 'new', 'bestseller', 'discount', 'premium', 'imported'];

const PRODUCTS = [
  { name: 'Smartphone Aurora 5G', category: 1, price: 4599000, stock: 32, tags: ['new', 'premium'] },
  { name: 'Smartphone Breeze 4G', category: 1, price: 1999000, stock: 48, tags: ['promo', 'bestseller'] },
  { name: 'Tablet Lumina 11', category: 1, price: 6299000, stock: 15, tags: ['premium'] },
  { name: 'Earbuds Echo Air', category: 1, price: 749000, stock: 120, tags: ['bestseller', 'promo'] },
  { name: 'Laptop Vertex 14 i7', category: 2, price: 15499000, stock: 9, tags: ['premium', 'imported'] },
  { name: 'Laptop Vertex 15 i5', category: 2, price: 10999000, stock: 14, tags: ['new'] },
  { name: 'Desktop Tower Titan', category: 2, price: 8799000, stock: 7, tags: [] },
  { name: 'Monitor ClearView 27', category: 2, price: 3299000, stock: 21, tags: ['bestseller'] },
  { name: 'Keyboard Mechanix TKL', category: 3, price: 899000, stock: 64, tags: ['promo', 'bestseller'] },
  { name: 'Mouse Glide Pro', category: 3, price: 349000, stock: 87, tags: ['promo'] },
  { name: 'Headset Studio One', category: 3, price: 1299000, stock: 40, tags: ['new', 'discount'] },
  { name: 'Webcam Focus 1080p', category: 3, price: 899000, stock: 53, tags: [] },
];

const ORDER_PLANS: { user: number; status: OrderStatus; items: [number, number][] }[] = [
  { user: 1, status: OrderStatus.COMPLETED, items: [[0, 1], [8, 2]] },
  { user: 2, status: OrderStatus.SHIPPED, items: [[4, 1]] },
  { user: 3, status: OrderStatus.PAID, items: [[1, 2], [3, 3], [9, 1]] },
  { user: 4, status: OrderStatus.PENDING, items: [[5, 1], [10, 1]] },
  { user: 5, status: OrderStatus.CANCELLED, items: [[2, 1]] },
  { user: 2, status: OrderStatus.PENDING, items: [[6, 1], [7, 2]] },
  { user: 3, status: OrderStatus.COMPLETED, items: [[11, 2]] },
  { user: 4, status: OrderStatus.SHIPPED, items: [[0, 2], [3, 1], [9, 4]] },
  { user: 5, status: OrderStatus.PAID, items: [[8, 1]] },
  { user: 2, status: OrderStatus.COMPLETED, items: [[1, 1], [2, 1], [10, 2], [11, 1]] },
];

const COMMENTS = [
  'Battery life is honestly better than advertised.',
  'Great phone, only wish the charger was included.',
  'Camera performs well even at night.',
  'Comfortable for long listening sessions.',
  'The case is a little bulky but the sound is excellent.',
  'Replaced my old laptop and the difference is night and day.',
  'Keyboard travel is comfortable for long coding sessions.',
  'Battery lasts about three days with notifications on.',
  'The tactile feel of these switches is superb.',
  'Loud enough for an office, not for late night work.',
  'Still relevant in 2026, highly recommended.',
  'Changed how I structure my projects.',
  'A gentle book that rewards a slow reader.',
  'Pre seasoning works perfectly out of the box.',
  'Colour matches the photos and it washes well.',
];

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) { }

  async onApplicationBootstrap(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    if (this.config.get<string>('DB_SEED') !== 'true') {
      return;
    }

    const existing = await this.dataSource.getRepository('users').count();

    if (existing > 0) {
      this.logger.log('Seed skipped, the users table is not empty.');

      return;
    }

    this.logger.log('Seeding demo data ...');

    await this.dataSource.transaction(async (manager) => {
      const password = await hashPassword(SEED_PASSWORD);
      const now = Date.now();

      const userIds = await this.insertMany(
        manager,
        'users',
        USERS.map((user, index) => ({
          name: user.name,
          email: user.email,
          password,
          role: user.role,
          createdAt: this.daysAgo(now, 60 - index),
          updatedAt: this.daysAgo(now, 60 - index),
        })),
      );

      const categoryIds = await this.insertMany(
        manager,
        'categories',
        CATEGORIES.map((category, index) => ({
          name: category.name,
          slug: slugify(category.name),
          description: category.description,
          createdAt: this.daysAgo(now, 50 - index),
          updatedAt: this.daysAgo(now, 50 - index),
        })),
      );

      const tagIds = await this.insertMany(
        manager,
        'tags',
        TAGS.map((tag, index) => ({
          name: tag,
          slug: tag,
          createdAt: this.daysAgo(now, 45 - index),
          updatedAt: this.daysAgo(now, 45 - index),
        })),
      );

      const productIds = await this.insertMany(
        manager,
        'products',
        PRODUCTS.map((product, index) => ({
          categoryId: categoryIds[product.category - 1],
          name: product.name,
          slug: slugify(product.name),
          description: `${product.name} is a demo product created for this backend template.`,
          price: product.price,
          stock: product.stock,
          createdAt: this.daysAgo(now, 40 - index),
          updatedAt: this.daysAgo(now, 40 - index),
        })),
      );

      const tagIdBySlug = new Map(TAGS.map((tag, index) => [tag, tagIds[index]]));
      const pivotValues = PRODUCTS.flatMap((product, productIndex) =>
        product.tags.map((tag) => ({
          productId: productIds[productIndex],
          tagId: tagIdBySlug.get(tag) ?? 0,
        })),
      );

      if (pivotValues.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into('product_tag')
          .values(pivotValues)
          .execute();
      }

      for (const [index, plan] of ORDER_PLANS.entries()) {
        const createdAt = this.daysAgo(now, 30 - index);
        const orderId = await this.insertOne(manager, 'orders', {
          userId: userIds[plan.user],
          status: plan.status,
          total: 0,
          createdAt,
          updatedAt: createdAt,
        });

        const items = plan.items.map(([productIndex, quantity]) => ({
          orderId,
          productId: productIds[productIndex],
          quantity,
          price: PRODUCTS[productIndex].price,
          createdAt,
          updatedAt: createdAt,
        }));
        const total = this.round2(
          items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
        );

        await manager.createQueryBuilder().insert().into('order_items').values(items).execute();
        await manager
          .createQueryBuilder()
          .update('orders')
          .set({ total })
          .where('id = :orderId', { orderId })
          .execute();
      }

      await this.insertMany(
        manager,
        'comments',
        COMMENTS.map((body, index) => {
          const createdAt = this.daysAgo(now, 25 - index);

          return {
            productId: productIds[index % productIds.length],
            userId: userIds[(index % (userIds.length - 1)) + 1],
            body,
            createdAt,
            updatedAt: createdAt,
          };
        }),
      );
    });

    this.logger.log(
      `Seed finished. Login with ${USERS[0].email} / ${SEED_PASSWORD} (role: ${USERS[0].role}).`,
    );
  }

  /**
   * Inserts one row and returns the generated id. Keys are entity *property*
   * names (camelCase) because TypeORM maps them onto the snake_case columns.
   */
  private async insertOne(
    manager: EntityManager,
    table: string,
    values: Record<string, unknown>,
  ): Promise<number> {
    const result = await manager.createQueryBuilder().insert().into(table).values(values).execute();
    const raw = result.raw as { insertId?: number | string };

    return Number(raw.insertId ?? 0);
  }

  private async insertMany(
    manager: EntityManager,
    table: string,
    rows: Record<string, unknown>[],
  ): Promise<number[]> {
    const ids: number[] = [];

    for (const row of rows) {
      ids.push(await this.insertOne(manager, table, row));
    }

    return ids;
  }

  private daysAgo(timestamp: number, days: number): Date {
    return new Date(timestamp - days * 24 * 60 * 60 * 1000);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
