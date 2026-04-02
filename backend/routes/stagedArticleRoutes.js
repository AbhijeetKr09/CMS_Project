import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/cmsAuth.js';
import {
    createDraft,
    updateDraft,
    submitForReview,
    listMine,
    listSubmissions,
    getById,
    addNote,
    requestChanges,
    publish,
    recall,
    listJournalists,
    deleteArticle,
    deleteStagedDraft,
} from '../controllers/stagedArticleController.js';

const router = Router();

// All routes require a valid CMS JWT
router.use(authenticate);

// ─── Journalist routes ───────────────────────────────────────────────────────
router.get('/mine', requireRole('JOURNALIST', 'EDITOR', 'ADMIN'), listMine);
router.post('/', requireRole('JOURNALIST', 'EDITOR', 'ADMIN'), createDraft);
router.put('/:id', requireRole('JOURNALIST', 'EDITOR', 'ADMIN'), updateDraft);
router.put('/:id/submit', requireRole('JOURNALIST', 'EDITOR', 'ADMIN'), submitForReview);

// ─── Editor routes ───────────────────────────────────────────────────────────
router.get('/', requireRole('EDITOR', 'ADMIN'), listSubmissions);
router.get('/journalists', requireRole('EDITOR', 'ADMIN'), listJournalists);
router.put('/:id/note', requireRole('EDITOR', 'ADMIN'), addNote);
router.put('/:id/request-changes', requireRole('EDITOR', 'ADMIN'), requestChanges);
router.post('/:id/publish', requireRole('EDITOR', 'ADMIN'), publish);
router.post('/recall/:articleId', requireRole('EDITOR', 'ADMIN'), recall);
router.delete('/article/:articleId', requireRole('EDITOR', 'ADMIN'), deleteArticle);

// ─── Shared ──────────────────────────────────────────────────────────────────
router.get('/:id', getById); // access control handled inside controller

// ─── Delete staged draft (owner or editor/admin) — includes S3 cleanup ───────
router.delete('/draft/:id', deleteStagedDraft);

export default router;
