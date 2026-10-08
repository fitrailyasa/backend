import { Router } from 'express';
import * as controller from '../controllers/userController.js';
import {
  listRules,
  showRules,
  storeRules,
  updateRules,
  profileUpdateRules,
} from '../validators/user.validator.js';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/me', controller.me);
router.patch('/me', validate(profileUpdateRules), controller.updateMe);

router.get('/', authorize('admin'), validate(listRules), controller.index);
router.post('/', authorize('admin'), validate(storeRules), controller.store);
router.get('/:id', authorize('admin'), validate(showRules), controller.show);
router.put('/:id', authorize('admin'), validate([...showRules, ...storeRules]), controller.update);
router.patch('/:id', authorize('admin'), validate(updateRules), controller.update);
router.delete('/:id', authorize('admin'), validate(showRules), controller.destroy);

export default router;
