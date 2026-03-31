import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/cmsAuth.js';
import { login, listUsers, createUser, updateUserRole, resetUserPassword, deleteUser } from '../controllers/cmsAuthController.js';

const router = Router();

// Public: login
router.post('/login', login);

// Protected: user management (EDITOR + ADMIN)
router.get('/',                 authenticate, requireRole('EDITOR', 'ADMIN'), listUsers);
router.post('/',                authenticate, requireRole('EDITOR', 'ADMIN'), createUser);
router.put('/:id/role',         authenticate, requireRole('EDITOR', 'ADMIN'), updateUserRole);
router.post('/:id/reset-password', authenticate, requireRole('EDITOR', 'ADMIN'), resetUserPassword);
router.delete('/:id',           authenticate, requireRole('EDITOR', 'ADMIN'), deleteUser);

export default router;
