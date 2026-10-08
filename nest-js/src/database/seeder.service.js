const { Injectable, Logger, Inject } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { InjectDataSource } = require('@nestjs/typeorm');
const { hashPassword } = require('../common/utils/password');
const { slugify } = require('../common/utils/slugify');

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
  {
    name: 'Smartphone Aurora 5G',
    category: 1,
    price: 4599000,
    stock: 32,
    tags: ['new', 'premium'],
  },
  {
    name: 'Smartphone Breeze 4G',
    category: 1,
    price: 1999000,
    stock: 48,
    tags: ['promo', 'bestseller'],
  },
  { name: 'Tablet Lumina 11', category: 1, price: 6299000, stock: 15, tags: ['premium'] },
  {
    name: 'Earbuds Echo Air',
    category: 1,
    price: 749000,
    stock: 120,
    tags: ['bestseller', 'promo'],
  },
  {
    name: 'Laptop Vertex 14 i7',
    category: 2,
    price: 15499000,
    stock: 9,
    tags: ['premium', 'imported'],
  },
  { name: 'Laptop Vertex 15 i5', category: 2, price: 10999000, stock: 14, tags: ['new'] },
  { name: 'Desktop Tower Titan', category: 2, price: 8799000, stock: 7, tags: [] },
  { name: 'Monitor ClearView 27', category: 2, price: 3299000, stock: 21, tags: ['bestseller'] },
  {
    name: 'Keyboard Mechanix TKL',
    category: 3,
    price: 899000,
    stock: 64,
    tags: ['promo', 'bestseller'],
  },
  { name: 'Mouse Glide Pro', category: 3, price: 349000, stock: 87, tags: ['promo'] },
  { name: 'Headset Studio One', category: 3, price: 1299000, stock: 40, tags: ['new', 'discount'] },
  { name: 'Webcam Focus 1080p', category: 3, price: 899000, stock: 53, tags: [] },
];

const ORDER_PLANS = [
  {
    user: 1,
    status: 'completed',
    items: [
      [0, 1],
      [8, 2],
    ],
  },
  { user: 2, status: 'shipped', items: [[4, 1]] },
  {
    user: 3,
    status: 'paid',
    items: [
      [1, 2],
      [3, 3],
      [9, 1],
    ],
  },
  {
    user: 4,
    status: 'pending',
    items: [
      [5, 1],
      [10, 1],
    ],
  },
  { user: 5, status: 'cancelled', items: [[2, 1]] },
  {
    user: 2,
    status: 'pending',
    items: [
      [6, 1],
      [7, 2],
    ],
  },
  { user: 3, status: 'completed', items: [[11, 2]] },
  {
    user: 4,
    status: 'shipped',
    items: [
      [0, 2],
      [3, 1],
      [9, 4],
    ],
  },
  { user: 5, status: 'paid', items: [[8, 1]] },
  {
    user: 2,
    status: 'completed',
    items: [
      [1, 1],
      [2, 1],
      [10, 2],
      [11, 1],
    ],
  },
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
class SeederService {
  logger = new Logger(SeederService.name);

  @InjectDataSource()
  dataSource;

  @Inject(ConfigService)
  config;

  async onApplicationBootstrap() {
    if (this.config.get('DB_SEED') === 'true') {
      await this.seed();
    }
  }

  async seed() {
    const existing = await this.dataSource.getRepository('users').count();
    if (existing > 0) {
      this.logger.log('Seed skipped, the users table is not empty.');
      return;
    }

    this.logger.log('Seeding demo data ...');

    await this.dataSource.transaction(async (manager) => {
      const passwordHash = await hashPassword(SEED_PASSWORD);

      // 1. Users
      const users = [];
      for (const u of USERS) {
        const user = manager.create('users', {
          name: u.name,
          email: u.email,
          password: passwordHash,
          role: u.role,
        });
        users.push(await manager.save(user));
      }

      // 2. Categories
      const categories = [];
      for (const c of CATEGORIES) {
        const cat = manager.create('categories', {
          name: c.name,
          slug: slugify(c.name),
          description: c.description,
        });
        categories.push(await manager.save(cat));
      }

      // 3. Tags
      const tags = [];
      for (const t of TAGS) {
        const tag = manager.create('tags', {
          name: t,
          slug: slugify(t),
        });
        tags.push(await manager.save(tag));
      }

      const tagMap = new Map(tags.map((t) => [t.name, t]));

      // 4. Products
      const products = [];
      for (const p of PRODUCTS) {
        const product = manager.create('products', {
          name: p.name,
          slug: slugify(p.name),
          description: `Description for ${p.name}.`,
          price: p.price,
          stock: p.stock,
          categoryId: categories[p.category - 1].id,
        });
        const savedProduct = await manager.save(product);
        products.push(savedProduct);

        for (const tagName of p.tags) {
          const tag = tagMap.get(tagName);
          if (tag) {
            await manager.save(
              manager.create('product_tag', {
                productId: savedProduct.id,
                tagId: tag.id,
              }),
            );
          }
        }
      }

      // 5. Orders & Order Items
      for (const plan of ORDER_PLANS) {
        const orderUser = users[plan.user - 1];
        let total = 0;
        const itemsToCreate = [];

        for (const [prodIndex, quantity] of plan.items) {
          const prod = products[prodIndex];
          const price = Number(prod.price);
          total += price * quantity;
          itemsToCreate.push({ productId: prod.id, quantity, price });
        }

        const order = await manager.save(
          manager.create('orders', {
            userId: orderUser.id,
            status: plan.status,
            total,
          }),
        );

        for (const item of itemsToCreate) {
          await manager.save(
            manager.create('order_items', {
              orderId: order.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            }),
          );
        }
      }

      // 6. Comments
      for (let i = 0; i < COMMENTS.length; i++) {
        const prod = products[i % products.length];
        const user = users[(i % (users.length - 1)) + 1];
        await manager.save(
          manager.create('comments', {
            productId: prod.id,
            userId: user.id,
            body: COMMENTS[i],
          }),
        );
      }
    });

    this.logger.log('Demo data seeded successfully.');
  }
}

module.exports = { SeederService };
