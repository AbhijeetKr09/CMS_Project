import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/cmsAuth.js';
import { listComments, deleteComment } from '../controllers/commentModerationController.js';

const router = Router();

// All comment moderation requires Editor or Admin role
router.use(authenticate, requireRole('EDITOR', 'ADMIN'));

// GET  /cms/comments/:articleId  → list all comments for an article
router.get('/:articleId', listComments);

// DELETE /cms/comments/:id → remove a specific comment
router.delete('/:id', deleteComment);

export default router;
