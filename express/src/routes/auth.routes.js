import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { registerRules, loginRules } from '../validators/auth.validator.js';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import rateLimit from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', rateLimit(), validate(registerRules), controller.register);
router.post('/login', rateLimit(), validate(loginRules), controller.login);
router.post('/refresh', rateLimit(), controller.refresh);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);

export default router;
