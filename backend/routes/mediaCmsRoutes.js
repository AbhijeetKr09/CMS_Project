import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/cmsAuth.js';
import { listMedia, createMedia, updateMedia, deleteMedia } from '../controllers/mediaCmsController.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('EDITOR', 'ADMIN'));

router.get('/',       listMedia);
router.post('/',      createMedia);
router.put('/:id',    updateMedia);
router.delete('/:id', deleteMedia);

export default router;
