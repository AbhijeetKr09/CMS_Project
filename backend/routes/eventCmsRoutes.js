import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/cmsAuth.js';
import { listEvents, getEvent, createEvent, updateEvent, deleteEvent } from '../controllers/eventCmsController.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('EDITOR', 'ADMIN'));

router.get('/',     listEvents);
router.get('/:id',  getEvent);
router.post('/',    createEvent);
router.put('/:id',  updateEvent);
router.delete('/:id', deleteEvent);

export default router;
