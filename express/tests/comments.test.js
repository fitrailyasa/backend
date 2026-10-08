import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  request,
  createAdmin,
  createCategory,
  createComment,
  createProduct,
  createUser,
  login,
  resetDatabase,
  db,
} from './helpers.js';

const PREFIX = '/api/v1';

describe('Comments', () => {
  let admin;
  let adminToken;
  let author;
  let authorToken;
  let stranger;
  let strangerToken;
  let product;
  let otherProduct;

  beforeEach(async () => {
    await resetDatabase();

    admin = await createAdmin({ name: 'Admin', email: 'admin@example.com' });
    adminToken = await login(admin.email);
    author = await createUser({ name: 'Author', email: 'author@example.com' });
    authorToken = await login(author.email);
    stranger = await createUser({ name: 'Stranger' });
    strangerToken = await login(stranger.email);

    const category = await createCategory({ name: 'Electronics' });
    product = await createProduct({ category, name: 'Smartphone' });
    otherProduct = await createProduct({ category, name: 'Laptop' });
  });

  describe('GET /products/:productId/comments', () => {
    it('lists comments publicly with meta', async () => {
      await createComment(product, author, 'First comment');
      await createComment(product, stranger, 'Second comment');
      await createComment(otherProduct, author, 'Other product comment');

      const response = await request.get(`${PREFIX}/products/${product.id}/comments`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Comments retrieved');
      assert.equal(response.body.meta.total, 2);
      assert.equal(response.body.data.length, 2);
    });

    it('searches on the body', async () => {
      await createComment(product, author, 'Battery is amazing');
      await createComment(product, author, 'Camera is fine');

      const response = await request
        .get(`${PREFIX}/products/${product.id}/comments`)
        .query({ search: 'battery' });

      assert.equal(response.status, 200);
      assert.equal(response.body.meta.total, 1);
    });

    it('eager loads the user without exposing the password', async () => {
      await createComment(product, author, 'With author');

      const response = await request
        .get(`${PREFIX}/products/${product.id}/comments`)
        .query({ include: 'user' });

      assert.equal(response.status, 200);
      assert.equal(response.body.data[0].user.email, 'author@example.com');
      assert.equal('password' in response.body.data[0].user, false);
    });

    it('returns 404 for an unknown product', async () => {
      const response = await request.get(`${PREFIX}/products/999999/comments`);
      assert.equal(response.status, 404);
    });

    it('returns 422 for a non numeric product id', async () => {
      const response = await request.get(`${PREFIX}/products/abc/comments`);
      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.productId));
    });
  });

  describe('GET /comments', () => {
    it('filters across products by product_id', async () => {
      await createComment(product, author, 'On the phone');
      await createComment(otherProduct, author, 'On the laptop');

      const response = await request.get(`${PREFIX}/comments`).query({ product_id: product.id });

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Comments retrieved');
      assert.equal(response.body.meta.total, 1);
      assert.equal(response.body.data[0].body, 'On the phone');
    });
  });

  describe('POST /products/:productId/comments', () => {
    it('creates a comment for the authenticated user', async () => {
      const response = await request
        .post(`${PREFIX}/products/${product.id}/comments`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ body: 'Great product!' });

      assert.equal(response.status, 201);
      assert.equal(response.body.message, 'Comment created successfully');
      assert.equal(response.body.data.body, 'Great product!');
      assert.equal(response.body.data.product_id, product.id);
      assert.equal(response.body.data.user_id, author.id);
    });

    it('returns 401 without a token', async () => {
      const response = await request.post(`${PREFIX}/products/${product.id}/comments`).send({ body: 'Anon' });
      assert.equal(response.status, 401);
    });

    it('returns 422 when the body is missing', async () => {
      const response = await request
        .post(`${PREFIX}/products/${product.id}/comments`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({});

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.body));
    });

    it('returns 404 for an unknown product', async () => {
      const response = await request
        .post(`${PREFIX}/products/999999/comments`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ body: 'Ghost product' });

      assert.equal(response.status, 404);
    });
  });

  describe('PATCH /comments/:id', () => {
    it('lets the owner update the comment', async () => {
      const comment = await createComment(product, author, 'Original');

      const response = await request
        .patch(`${PREFIX}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ body: 'Edited' });

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Comment updated successfully');
      assert.equal(response.body.data.body, 'Edited');
    });

    it('lets an admin update any comment', async () => {
      const comment = await createComment(product, author, 'Original');

      const response = await request
        .patch(`${PREFIX}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Moderated' });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.body, 'Moderated');
    });

    it('returns 403 for a different user', async () => {
      const comment = await createComment(product, author, 'Original');

      const response = await request
        .patch(`${PREFIX}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ body: 'Hijacked' });

      assert.equal(response.status, 403);
    });

    it('returns 404 for an unknown comment', async () => {
      const response = await request
        .patch(`${PREFIX}/comments/999999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Ghost' });

      assert.equal(response.status, 404);
    });

    it('returns 422 when the body is missing', async () => {
      const comment = await createComment(product, author, 'Original');

      const response = await request
        .patch(`${PREFIX}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({});

      assert.equal(response.status, 422);
    });
  });

  describe('DELETE /comments/:id', () => {
    it('lets the owner delete the comment', async () => {
      const comment = await createComment(product, author, 'Doomed');

      const response = await request.delete(`${PREFIX}/comments/${comment.id}`).set('Authorization', `Bearer ${authorToken}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Comment deleted successfully');

      const remaining = await db.Comment.count({ where: { id: comment.id } });
      assert.equal(remaining, 0);
    });

    it('lets an admin delete any comment', async () => {
      const comment = await createComment(product, author, 'Doomed');

      const response = await request.delete(`${PREFIX}/comments/${comment.id}`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 200);
    });

    it('returns 403 for a different user', async () => {
      const comment = await createComment(product, author, 'Doomed');

      const response = await request.delete(`${PREFIX}/comments/${comment.id}`).set('Authorization', `Bearer ${strangerToken}`);
      assert.equal(response.status, 403);

      const remaining = await db.Comment.count({ where: { id: comment.id } });
      assert.equal(remaining, 1);
    });

    it('returns 404 for an unknown comment', async () => {
      const response = await request.delete(`${PREFIX}/comments/999999`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 404);
    });

    it('returns 401 without a token', async () => {
      const comment = await createComment(product, author, 'Doomed');
      const response = await request.delete(`${PREFIX}/comments/${comment.id}`);
      assert.equal(response.status, 401);
    });
  });

  describe('cascade behaviour', () => {
    it('removes comments when the product is deleted', async () => {
      await createComment(product, author, 'Will be cascaded');

      await request.delete(`${PREFIX}/products/${product.id}`).set('Authorization', `Bearer ${adminToken}`);

      const remaining = await db.Comment.count({ where: { product_id: product.id } });
      assert.equal(remaining, 0);
    });
  });
});
