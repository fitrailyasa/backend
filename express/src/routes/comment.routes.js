import { Router } from 'express';
import * as commentController from '../controllers/commentController.js';
import { listRules, listByProductRules, storeRules, updateRules, showRules } from '../validators/comment.validator.js';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';

/** Mounted at /api/v1/comments */
export const commentRouter = Router();

commentRouter.get('/', validate(listRules), commentController.index);
commentRouter.patch('/:id', authenticate, validate(updateRules), commentController.update);
commentRouter.delete('/:id', authenticate, validate(showRules), commentController.destroy);

/** Mounted at /api/v1 to expose the product nested comment endpoints */
export const productCommentRouter = Router();

productCommentRouter.get(
  '/products/:productId/comments',
  validate(listByProductRules),
  commentController.indexByProduct,
);
productCommentRouter.post(
  '/products/:productId/comments',
  authenticate,
  validate(storeRules),
  commentController.store,
);

export default commentRouter;
