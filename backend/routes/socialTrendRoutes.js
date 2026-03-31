import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/cmsAuth.js';
import { listTrends, createTrend, updateTrend, deleteTrend, toggleTrend } from '../controllers/socialTrendController.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('EDITOR', 'ADMIN'));

router.get('/',             listTrends);
router.post('/',            createTrend);
router.put('/:id',          updateTrend);
router.delete('/:id',       deleteTrend);
router.patch('/:id/toggle', toggleTrend);

export default router;
