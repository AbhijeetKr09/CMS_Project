import { Router } from 'express';
import { login } from '../controllers/cmsAuthController.js';

const router = Router();

// POST /cms/auth/login
router.post('/login', login);

export default router;
