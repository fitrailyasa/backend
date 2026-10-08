import { Router } from 'express';
import * as controller from '../controllers/productController.js';
import { listRules, showRules, storeRules, updateRules } from '../validators/product.validator.js';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';

const router = Router();

router.get('/', validate(listRules), controller.index);
router.get('/:id', validate(showRules), controller.show);

router.post('/', authenticate, authorize('admin'), validate(storeRules), controller.store);
router.put('/:id', authenticate, authorize('admin'), validate([...showRules, ...storeRules]), controller.update);
router.patch('/:id', authenticate, authorize('admin'), validate(updateRules), controller.update);
router.delete('/:id', authenticate, authorize('admin'), validate(showRules), controller.destroy);

export default router;
