import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { registerRules, loginRules } from '../validators/auth.validator.js';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import rateLimit from '../middleware/rateLimit.js';
import loginRateLimit from '../middleware/loginRateLimit.js';

const router = Router();

router.post('/register', rateLimit(), validate(registerRules), controller.register);
// The login limiter checks the lock before any password hashing/verification.
router.post('/login', loginRateLimit(), rateLimit(), validate(loginRules), controller.login);
router.post('/refresh', rateLimit(), controller.refresh);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);

export default router;
