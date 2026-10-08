import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase, syncDatabase } from './config/database.js';
import { User, Category, Product, Tag, Comment } from './models/index.js';
import * as orderService from './services/orderService.js';

const ADMIN = { name: 'Site Administrator', email: 'admin@example.com', password: 'password', role: 'admin' };

const USERS = [
  { name: 'User', email: 'user@example.com', password: 'password', role: 'user' },
  { name: 'User 2', email: 'user2@example.com', password: 'password', role: 'user' },
  { name: 'User 3', email: 'user3@example.com', password: 'password', role: 'user' },
  { name: 'User 4', email: 'user4@example.com', password: 'password', role: 'user' },
  { name: 'User 5', email: 'user5@example.com', password: 'password', role: 'user' },
];

const CATEGORIES = [
  { name: 'Electronics', description: 'Phones, laptops, audio and every day gadgets.' },
  { name: 'Books', description: 'Fiction, non fiction and academic books.' },
  { name: 'Home & Living', description: 'Kitchenware, decoration and furniture.' },
];

const TAGS = ['Featured', 'New Arrival', 'Best Seller', 'Discount', 'Premium', 'Eco Friendly'];

const PRODUCTS = [
  { category: 'Electronics', name: 'Smartphone X Pro', price: 8990000, stock: 40, description: '6.7 inch AMOLED display with a triple camera.' },
  { category: 'Electronics', name: 'Wireless Earbuds Z', price: 749000, stock: 120, description: 'Active noise cancelling earbuds with 30 hours of playback.' },
  { category: 'Electronics', name: 'Ultra Slim Laptop 14', price: 15999000, stock: 25, description: '14 inch ultrabook with 16GB RAM and 512GB SSD.' },
  { category: 'Electronics', name: 'Smart Watch S2', price: 1299000, stock: 80, description: 'GPS tracking, heart rate and sleep monitoring.' },
  { category: 'Electronics', name: 'Mechanical Keyboard K1', price: 899000, stock: 60, description: 'Hot swappable switches with a aluminium frame.' },
  { category: 'Books', name: 'The Pragmatic Programmer', price: 289000, stock: 200, description: 'A classic guide to software craftsmanship.' },
  { category: 'Books', name: 'Clean Architecture', price: 315000, stock: 150, description: 'A craftsman guide to software structure and design.' },
  { category: 'Books', name: 'Daring Greatly', price: 199000, stock: 180, description: 'How to build a remarkable life at work.' },
  { category: 'Home & Living', name: 'Cast Iron Skillet 26cm', price: 349000, stock: 90, description: 'Pre seasoned skillet, oven safe up to 260C.' },
  { category: 'Home & Living', name: 'Linen Table Runner', price: 129000, stock: 140, description: 'Hand washed linen runner for a 180cm table.' },
];

const ORDERS = [
  { user: 0, status: 'completed', items: [{ product: 0, quantity: 1 }, { product: 4, quantity: 2 }] },
  { user: 1, status: 'shipped', items: [{ product: 2, quantity: 1 }] },
  { user: 2, status: 'paid', items: [{ product: 1, quantity: 3 }] },
  { user: 3, status: 'pending', items: [{ product: 5, quantity: 2 }, { product: 7, quantity: 1 }] },
  { user: 4, status: 'completed', items: [{ product: 8, quantity: 1 }] },
  { user: 0, status: 'cancelled', items: [{ product: 3, quantity: 1 }] },
  { user: 1, status: 'paid', items: [{ product: 6, quantity: 4 }] },
  { user: 2, status: 'pending', items: [{ product: 9, quantity: 2 }] },
  { user: 3, status: 'shipped', items: [{ product: 0, quantity: 2 }, { product: 1, quantity: 1 }] },
  { user: 4, status: 'completed', items: [{ product: 5, quantity: 1 }, { product: 8, quantity: 2 }] },
];

const COMMENTS = [
  { product: 0, user: 1, body: 'Battery life is honestly better than advertised.' },
  { product: 0, user: 2, body: 'Great phone, only wish the charger was included.' },
  { product: 0, user: 3, body: 'Camera performs well even at night.' },
  { product: 1, user: 0, body: 'Comfortable for long listening sessions.' },
  { product: 1, user: 4, body: 'The case is a little bulky but the sound is excellent.' },
  { product: 2, user: 2, body: 'Replaced my old laptop and the difference is night and day.' },
  { product: 2, user: 3, body: 'Keyboard travel is comfortable for long coding sessions.' },
  { product: 3, user: 1, body: 'Battery lasts about three days with notifications on.' },
  { product: 4, user: 0, body: 'The tactile feel of these switches is superb.' },
  { product: 4, user: 2, body: 'Loud enough for an office, not for late night work.' },
  { product: 5, user: 3, body: 'Still relevant in 2026, highly recommended.' },
  { product: 6, user: 4, body: 'Changed how I structure my projects.' },
  { product: 7, user: 1, body: 'A gentle book that rewards a slow reader.' },
  { product: 8, user: 2, body: 'Pre seasoning works perfectly out of the box.' },
  { product: 9, user: 0, body: 'Colour matches the photos and it washes well.' },
];

export async function seedDemoData({ reset = true } = {}) {
  if (reset) {
    await syncDatabase({ force: true });
  }

  const users = [];
  users.push(await User.create(ADMIN));
  for (const payload of USERS) {
    users.push(await User.create(payload));
  }

  const categories = [];
  for (const payload of CATEGORIES) {
    categories.push(await Category.create(payload));
  }
  const categoryByName = new Map(categories.map((category) => [category.name, category]));

  const tags = [];
  for (const name of TAGS) {
    tags.push(await Tag.create({ name }));
  }

  const products = [];
  for (const payload of PRODUCTS) {
    const product = await Product.create({
      category_id: categoryByName.get(payload.category).id,
      name: payload.name,
      description: payload.description,
      price: payload.price,
      stock: payload.stock,
    });
    const assigned = tags.filter((_, index) => (index + products.length) % 3 === 0);
    if (assigned.length > 0) await product.setTags(assigned.map((tag) => tag.id));
    products.push(product);
  }

  const orders = [];
  for (const payload of ORDERS) {
    const order = await orderService.create(
      {
        items: payload.items.map((item) => ({ product_id: products[item.product].id, quantity: item.quantity })),
      },
      { id: users[payload.user].id, role: 'user' },
    );
    if (payload.status !== 'pending') {
      await order.update({ status: payload.status });
    }
    orders.push(order);
  }

  const comments = [];
  for (const payload of COMMENTS) {
    comments.push(
      await Comment.create({
        product_id: products[payload.product].id,
        user_id: users[payload.user].id,
        body: payload.body,
      }),
    );
  }

  return {
    users: users.length,
    categories: categories.length,
    products: products.length,
    tags: tags.length,
    orders: orders.length,
    comments: comments.length,
  };
}

async function main() {
  await connectDatabase();
  const summary = await seedDemoData({ reset: true });
  console.log('[seed] demo data created:', summary);
  console.log('[seed] admin login -> admin@example.com / password');
  await disconnectDatabase();
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error('[seed] failed', error);
    process.exit(1);
  });
}

export default seedDemoData;
