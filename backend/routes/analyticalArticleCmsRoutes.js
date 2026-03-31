import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/cmsAuth.js';
import { listAnalytical, getAnalytical, createAnalytical, updateAnalytical, deleteAnalytical } from '../controllers/analyticalArticleCmsController.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('EDITOR', 'ADMIN'));

router.get('/',       listAnalytical);
router.get('/:id',    getAnalytical);
router.post('/',      createAnalytical);
router.put('/:id',    updateAnalytical);
router.delete('/:id', deleteAnalytical);

export default router;
