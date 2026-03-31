import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/cmsAuth.js';
import { listExperts, getExpert, createExpert, updateExpert, deleteExpert, toggleExpert } from '../controllers/expertCmsController.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('EDITOR', 'ADMIN'));

router.get('/',             listExperts);
router.get('/:id',          getExpert);
router.post('/',            createExpert);
router.put('/:id',          updateExpert);
router.delete('/:id',       deleteExpert);
router.patch('/:id/toggle', toggleExpert);

export default router;
