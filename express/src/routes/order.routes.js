import { Router } from 'express';
import * as controller from '../controllers/orderController.js';
import { listRules, showRules, storeRules, updateStatusRules } from '../validators/order.validator.js';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/', validate(listRules), controller.index);
router.post('/', validate(storeRules), controller.store);
router.get('/:id', validate(showRules), controller.show);
router.patch('/:id/status', validate(updateStatusRules), controller.updateStatus);
router.delete('/:id', authorize('admin'), validate(showRules), controller.destroy);

export default router;
