import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/cmsAuth.js';
import { listAirlines, createAirline, updateAirline, deleteAirline, listReviews } from '../controllers/airlineCmsController.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('EDITOR', 'ADMIN'));

// Airlines
router.get('/airlines',          listAirlines);
router.post('/airlines',         createAirline);
router.put('/airlines/:id',      updateAirline);
router.delete('/airlines/:id',   deleteAirline);

// Flight Reviews (read-only)
router.get('/flight-reviews',    listReviews);

export default router;
