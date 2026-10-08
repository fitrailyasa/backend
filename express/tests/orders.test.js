import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  request,
  createAdmin,
  createCategory,
  createOrderRecord,
  createProduct,
  createUser,
  login,
  resetDatabase,
} from './helpers.js';

const PREFIX = '/api/v1';

describe('Orders', () => {
  let admin;
  let adminToken;
  let buyer;
  let buyerToken;
  let other;
  let otherToken;
  let category;
  let product;
  let cheap;

  beforeEach(async () => {
    await resetDatabase();

    admin = await createAdmin({ name: 'Admin', email: 'admin@example.com' });
    adminToken = await login(admin.email);
    buyer = await createUser({ name: 'Buyer', email: 'buyer@example.com' });
    buyerToken = await login(buyer.email);
    other = await createUser({ name: 'Other' });
    otherToken = await login(other.email);

    category = await createCategory({ name: 'Electronics' });
    product = await createProduct({ category, name: 'Smartphone', price: 250, stock: 10 });
    cheap = await createProduct({ category, name: 'Cable', price: 10.5, stock: 100 });
  });

  describe('POST /orders', () => {
    it('computes the total server side and decrements stock', async () => {
      const response = await request
        .post(`${PREFIX}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ items: [{ product_id: product.id, quantity: 2 }, { product_id: cheap.id, quantity: 3 }] });

      assert.equal(response.status, 201);
      assert.equal(response.body.message, 'Order created successfully');
      assert.equal(response.body.data.status, 'pending');
      assert.equal(response.body.data.user_id, buyer.id);
      assert.equal(response.body.data.total, 531.5);
      assert.equal(response.body.data.items.length, 2);

      const lines = response.body.data.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
      }));
      assert.deepEqual(lines, [
        { product_id: product.id, quantity: 2, price: 250 },
        { product_id: cheap.id, quantity: 3, price: 10.5 },
      ]);

      const { db } = await import('./helpers.js');
      const reloadedProduct = await db.Product.findByPk(product.id);
      const reloadedCheap = await db.Product.findByPk(cheap.id);
      assert.equal(reloadedProduct.stock, 8);
      assert.equal(reloadedCheap.stock, 97);
    });

    it('ignores a total supplied by the client', async () => {
      const response = await request
        .post(`${PREFIX}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ items: [{ product_id: product.id, quantity: 1 }], total: 0.01 });

      assert.equal(response.status, 201);
      assert.equal(response.body.data.total, 250);
    });

    it('returns 404 for an unknown product', async () => {
      const response = await request
        .post(`${PREFIX}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ items: [{ product_id: 999999, quantity: 1 }] });

      assert.equal(response.status, 404);
      assert.equal(response.body.success, false);
    });

    it('returns 409 for insufficient stock and leaves stock untouched', async () => {
      const response = await request
        .post(`${PREFIX}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ items: [{ product_id: product.id, quantity: 999 }] });

      assert.equal(response.status, 409);
      assert.match(response.body.message, /Insufficient stock/);

      const { db } = await import('./helpers.js');
      const reloaded = await db.Product.findByPk(product.id);
      assert.equal(reloaded.stock, 10);
    });

    it('returns 422 when items is missing', async () => {
      const response = await request.post(`${PREFIX}/orders`).set('Authorization', `Bearer ${buyerToken}`).send({});

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.items));
    });

    it('returns 422 for a non positive quantity', async () => {
      const response = await request
        .post(`${PREFIX}/orders`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ items: [{ product_id: product.id, quantity: 0 }] });

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.items));
    });

    it('returns 401 without a token', async () => {
      const response = await request.post(`${PREFIX}/orders`).send({ items: [{ product_id: product.id, quantity: 1 }] });
      assert.equal(response.status, 401);
    });
  });

  describe('GET /orders', () => {
    it('returns only the caller orders for a regular user', async () => {
      await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });
      await createOrderRecord({ user: other, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request.get(`${PREFIX}/orders`).set('Authorization', `Bearer ${buyerToken}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Orders retrieved');
      assert.equal(response.body.meta.total, 1);
      assert.equal(response.body.data[0].user_id, buyer.id);
    });

    it('returns every order for an admin', async () => {
      await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });
      await createOrderRecord({ user: other, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request.get(`${PREFIX}/orders`).set('Authorization', `Bearer ${adminToken}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.meta.total, 2);
    });

    it('filters by status', async () => {
      await createOrderRecord({ user: buyer, status: 'paid', items: [{ product_id: product.id, quantity: 1 }] });
      await createOrderRecord({ user: buyer, status: 'pending', items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request
        .get(`${PREFIX}/orders`)
        .query({ status: 'paid' })
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.meta.total, 1);
      assert.equal(response.body.data[0].status, 'paid');
    });

    it('rejects an unknown status filter with 422', async () => {
      const response = await request
        .get(`${PREFIX}/orders`)
        .query({ status: 'refunded' })
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.status));
    });

    it('allows the user_id filter for an admin', async () => {
      await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });
      await createOrderRecord({ user: other, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request
        .get(`${PREFIX}/orders`)
        .query({ user_id: buyer.id })
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.meta.total, 1);
    });

    it('returns 403 when a regular user passes user_id', async () => {
      const response = await request
        .get(`${PREFIX}/orders`)
        .query({ user_id: other.id })
        .set('Authorization', `Bearer ${buyerToken}`);

      assert.equal(response.status, 403);
    });

    it('requires authentication', async () => {
      const response = await request.get(`${PREFIX}/orders`);
      assert.equal(response.status, 401);
    });
  });

  describe('GET /orders/:id', () => {
    it('lets the owner read the order', async () => {
      const order = await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request.get(`${PREFIX}/orders/${order.id}`).set('Authorization', `Bearer ${buyerToken}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Order retrieved');
      assert.equal(response.body.data.id, order.id);
    });

    it('lets an admin read any order', async () => {
      const order = await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request.get(`${PREFIX}/orders/${order.id}`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 200);
    });

    it('returns 403 for a different user', async () => {
      const order = await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request.get(`${PREFIX}/orders/${order.id}`).set('Authorization', `Bearer ${otherToken}`);
      assert.equal(response.status, 403);
    });

    it('returns 404 for an unknown order', async () => {
      const response = await request.get(`${PREFIX}/orders/999999`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 404);
    });

    it('eager loads items, items.product and user', async () => {
      const order = await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request
        .get(`${PREFIX}/orders/${order.id}`)
        .query({ include: 'items,items.product,user' })
        .set('Authorization', `Bearer ${buyerToken}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.data.items.length, 1);
      assert.equal(response.body.data.items[0].product.name, 'Smartphone');
      assert.equal(response.body.data.user.email, 'buyer@example.com');
      assert.equal('password' in response.body.data.user, false);
    });
  });

  describe('PATCH /orders/:id/status', () => {
    it('lets an owner cancel a pending order and restores stock', async () => {
      const order = await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 2 }] });
      const { db } = await import('./helpers.js');
      await db.Product.update({ stock: 8 }, { where: { id: product.id } });

      const response = await request
        .patch(`${PREFIX}/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ status: 'cancelled' });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.status, 'cancelled');

      const reloaded = await db.Product.findByPk(product.id);
      assert.equal(reloaded.stock, 10);
    });

    it('does not let an owner set a status other than cancelled', async () => {
      const order = await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request
        .patch(`${PREFIX}/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ status: 'shipped' });

      assert.equal(response.status, 403);
    });

    it('does not let an owner cancel a non pending order', async () => {
      const order = await createOrderRecord({ user: buyer, status: 'shipped', items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request
        .patch(`${PREFIX}/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ status: 'cancelled' });

      assert.equal(response.status, 403);
    });

    it('lets an admin move an order through the whole lifecycle', async () => {
      const order = await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });

      for (const status of ['paid', 'shipped', 'completed']) {
        const response = await request
          .patch(`${PREFIX}/orders/${order.id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status });

        assert.equal(response.status, 200, `expected 200 for ${status}`);
        assert.equal(response.body.data.status, status);
      }
    });

    it('returns 422 for an unknown status', async () => {
      const order = await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request
        .patch(`${PREFIX}/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'refunded' });

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.status));
    });

    it('returns 403 for a different user', async () => {
      const order = await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request
        .patch(`${PREFIX}/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ status: 'cancelled' });

      assert.equal(response.status, 403);
    });

    it('returns 404 for an unknown order', async () => {
      const response = await request
        .patch(`${PREFIX}/orders/999999/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paid' });

      assert.equal(response.status, 404);
    });
  });

  describe('DELETE /orders/:id', () => {
    it('lets an admin delete an order', async () => {
      const order = await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request.delete(`${PREFIX}/orders/${order.id}`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Order deleted successfully');

      const after = await request.get(`${PREFIX}/orders/${order.id}`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(after.status, 404);
    });

    it('returns 403 for a regular user', async () => {
      const order = await createOrderRecord({ user: buyer, items: [{ product_id: product.id, quantity: 1 }] });

      const response = await request.delete(`${PREFIX}/orders/${order.id}`).set('Authorization', `Bearer ${buyerToken}`);
      assert.equal(response.status, 403);
    });

    it('returns 404 for an unknown order', async () => {
      const response = await request.delete(`${PREFIX}/orders/999999`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 404);
    });
  });
});
