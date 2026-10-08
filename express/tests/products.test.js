import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  request,
  createAdmin,
  createCategory,
  createProduct,
  createTag,
  createUser,
  login,
  resetDatabase,
} from './helpers.js';

const PREFIX = '/api/v1';

describe('Catalogue (categories, products, tags)', () => {
  let admin;
  let adminToken;
  let user;
  let userToken;
  let category;
  let tag;
  let product;

  beforeEach(async () => {
    await resetDatabase();

    admin = await createAdmin({ name: 'Admin', email: 'admin@example.com' });
    adminToken = await login(admin.email);
    user = await createUser({ name: 'Regular' });
    userToken = await login(user.email);

    category = await createCategory({ name: 'Electronics' });
    tag = await createTag({ name: 'Featured' });
    product = await createProduct({
      category,
      name: 'Smartphone X',
      price: 500,
      stock: 10,
      description: 'A phone',
      tags: [tag],
    });
  });

  describe('Categories', () => {
    it('lists categories publicly with meta', async () => {
      const response = await request.get(`${PREFIX}/categories`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Categories retrieved');
      assert.equal(response.body.data.length, 1);
      assert.equal(response.body.meta.total, 1);
      assert.equal(response.body.data[0].name, 'Electronics');
    });

    it('shows one category publicly', async () => {
      const response = await request.get(`${PREFIX}/categories/${category.id}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.data.id, category.id);
    });

    it('returns 404 for an unknown category', async () => {
      const response = await request.get(`${PREFIX}/categories/999999`);
      assert.equal(response.status, 404);
    });

    it('auto generates the slug from the name', async () => {
      const response = await request
        .post(`${PREFIX}/categories`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Home & Living' });

      assert.equal(response.status, 201);
      assert.equal(response.body.data.slug, 'home-living');
    });

    it('returns 409 for a duplicate slug', async () => {
      const response = await request
        .post(`${PREFIX}/categories`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Electronics' });

      assert.equal(response.status, 409);
      assert.equal(response.body.success, false);
    });

    it('returns 403 when a regular user tries to create', async () => {
      const response = await request
        .post(`${PREFIX}/categories`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Nope' });

      assert.equal(response.status, 403);
    });

    it('returns 422 when the name is missing', async () => {
      const response = await request
        .post(`${PREFIX}/categories`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.name));
    });

    it('updates a category', async () => {
      const patch = await request
        .patch(`${PREFIX}/categories/${category.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Gadgets' });

      assert.equal(patch.status, 200);
      assert.equal(patch.body.data.name, 'Gadgets');
    });

    it('returns 409 when deleting a category that still has products', async () => {
      const response = await request.delete(`${PREFIX}/categories/${category.id}`).set('Authorization', `Bearer ${adminToken}`);

      assert.equal(response.status, 409);
      assert.equal(response.body.success, false);

      const after = await request.get(`${PREFIX}/categories/${category.id}`);
      assert.equal(after.status, 200);
    });

    it('deletes a category once it has no products', async () => {
      const productResponse = await request.delete(`${PREFIX}/products/${product.id}`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(productResponse.status, 200);

      const remove = await request.delete(`${PREFIX}/categories/${category.id}`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(remove.status, 200);

      const after = await request.get(`${PREFIX}/categories/${category.id}`);
      assert.equal(after.status, 404);
    });
  });

  describe('Tags', () => {
    it('lists tags publicly', async () => {
      const response = await request.get(`${PREFIX}/tags`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Tags retrieved');
      assert.equal(response.body.data[0].slug, 'featured');
    });

    it('creates a tag with an auto generated slug', async () => {
      const response = await request
        .post(`${PREFIX}/tags`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Arrival' });

      assert.equal(response.status, 201);
      assert.equal(response.body.data.slug, 'new-arrival');
    });

    it('returns 409 for a duplicate tag slug', async () => {
      const response = await request
        .post(`${PREFIX}/tags`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Featured' });

      assert.equal(response.status, 409);
    });

    it('deletes a tag', async () => {
      const response = await request.delete(`${PREFIX}/tags/${tag.id}`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 200);

      const after = await request.get(`${PREFIX}/tags/${tag.id}`);
      assert.equal(after.status, 404);
    });
  });

  describe('Products', () => {
    it('lists products publicly with meta', async () => {
      const response = await request.get(`${PREFIX}/products`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Products retrieved');
      assert.equal(response.body.meta.total, 1);
      assert.equal(response.body.data[0].name, 'Smartphone X');
    });

    it('shows a product publicly', async () => {
      const response = await request.get(`${PREFIX}/products/${product.id}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Product retrieved');
      assert.equal(response.body.data.price, 500);
    });

    it('returns 404 for an unknown product', async () => {
      const response = await request.get(`${PREFIX}/products/999999`);
      assert.equal(response.status, 404);
    });

    it('filters by category_id', async () => {
      const other = await createCategory({ name: 'Books' });
      await createProduct({ category: other, name: 'A Book', price: 20 });

      const response = await request.get(`${PREFIX}/products`).query({ category_id: category.id });

      assert.equal(response.status, 200);
      assert.equal(response.body.meta.total, 1);
      assert.equal(response.body.data[0].name, 'Smartphone X');
    });

    it('filters by tag_id', async () => {
      await createProduct({ category, name: 'Untagged', price: 10 });

      const response = await request.get(`${PREFIX}/products`).query({ tag_id: tag.id });

      assert.equal(response.status, 200);
      assert.equal(response.body.meta.total, 1);
      assert.equal(response.body.data[0].name, 'Smartphone X');
    });

    it('filters by tag slug', async () => {
      await createProduct({ category, name: 'Untagged', price: 10 });

      const response = await request.get(`${PREFIX}/products`).query({ tag: 'featured' });

      assert.equal(response.status, 200);
      assert.equal(response.body.meta.total, 1);
      assert.equal(response.body.data[0].name, 'Smartphone X');
    });

    it('filters by min_price and max_price', async () => {
      await createProduct({ category, name: 'Cheap', price: 10, stock: 5 });
      await createProduct({ category, name: 'Expensive', price: 900, stock: 5 });

      const min = await request.get(`${PREFIX}/products`).query({ min_price: 100 });
      assert.equal(min.body.meta.total, 2);

      const max = await request.get(`${PREFIX}/products`).query({ max_price: 600 });
      assert.equal(max.body.meta.total, 2);

      const range = await request.get(`${PREFIX}/products`).query({ min_price: 100, max_price: 600 });
      assert.equal(range.body.meta.total, 1);
      assert.equal(range.body.data[0].name, 'Smartphone X');
    });

    it('eager loads category and tags with include', async () => {
      const response = await request.get(`${PREFIX}/products`).query({ include: 'category,tags' });

      assert.equal(response.status, 200);
      assert.equal(response.body.data[0].category.name, 'Electronics');
      assert.equal(response.body.data[0].tags[0].slug, 'featured');
    });

    it('eager loads products on a category', async () => {
      const response = await request.get(`${PREFIX}/categories`).query({ include: 'products' });

      assert.equal(response.status, 200);
      assert.equal(response.body.data[0].products.length, 1);
    });

    it('rejects an unsupported include value with 422', async () => {
      const response = await request.get(`${PREFIX}/products`).query({ include: 'supplier' });
      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.include));
    });

    it('searches on name and description', async () => {
      const response = await request.get(`${PREFIX}/products`).query({ search: 'A phone' });

      assert.equal(response.status, 200);
      assert.equal(response.body.meta.total, 1);
    });

    it('sorts by price ascending', async () => {
      await createProduct({ category, name: 'Cheap', price: 10, stock: 5 });

      const response = await request.get(`${PREFIX}/products`).query({ sort: 'price', order: 'asc' });

      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data.map((row) => row.price), [10, 500]);
    });

    it('creates a product as an admin with an auto generated slug', async () => {
      const response = await request
        .post(`${PREFIX}/products`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category_id: category.id, name: 'Wireless Earbuds', price: 49.5, stock: 30, tags: [tag.id] });

      assert.equal(response.status, 201);
      assert.equal(response.body.message, 'Product created successfully');
      assert.equal(response.body.data.slug, 'wireless-earbuds');
      assert.equal(response.body.data.price, 49.5);
    });

    it('returns 409 for a duplicate product slug', async () => {
      const response = await request
        .post(`${PREFIX}/products`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category_id: category.id, name: 'Smartphone X', price: 10 });

      assert.equal(response.status, 409);
    });

    it('returns 422 for an unknown category', async () => {
      const response = await request
        .post(`${PREFIX}/products`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category_id: 999999, name: 'Orphan', price: 10 });

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.category_id));
    });

    it('returns 422 for a negative price', async () => {
      const response = await request
        .post(`${PREFIX}/products`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category_id: category.id, name: 'Cheap', price: -1 });

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.price));
    });

    it('returns 422 for an unknown tag', async () => {
      const response = await request
        .post(`${PREFIX}/products`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category_id: category.id, name: 'Tagged', price: 10, tags: [999999] });

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.tags));
    });

    it('returns 403 when a regular user tries to create', async () => {
      const response = await request
        .post(`${PREFIX}/products`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ category_id: category.id, name: 'Nope', price: 10 });

      assert.equal(response.status, 403);
    });

    it('returns 422 when required fields are missing', async () => {
      const response = await request
        .post(`${PREFIX}/products`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.category_id));
      assert.ok(Array.isArray(response.body.errors.name));
      assert.ok(Array.isArray(response.body.errors.price));
    });

    it('patches price and stock', async () => {
      const response = await request
        .patch(`${PREFIX}/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 650.25, stock: 3 });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.price, 650.25);
      assert.equal(response.body.data.stock, 3);
    });

    it('replaces the tags on update', async () => {
      const other = await createTag({ name: 'Premium' });

      const response = await request
        .patch(`${PREFIX}/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tags: [other.id] });

      assert.equal(response.status, 200);

      const reloaded = await request.get(`${PREFIX}/products/${product.id}`).query({ include: 'tags' });
      assert.equal(reloaded.body.data.tags.length, 1);
      assert.equal(reloaded.body.data.tags[0].slug, 'premium');
    });

    it('deletes a product', async () => {
      const response = await request.delete(`${PREFIX}/products/${product.id}`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 200);

      const after = await request.get(`${PREFIX}/products/${product.id}`);
      assert.equal(after.status, 404);
    });

    it('returns 403 when a regular user tries to delete', async () => {
      const response = await request.delete(`${PREFIX}/products/${product.id}`).set('Authorization', `Bearer ${userToken}`);
      assert.equal(response.status, 403);
    });
  });
});
