import express from 'express';
const router = express.Router();

import { createArticle, getArticles, getArticleById, updateArticle, deleteArticle, getNextArticleId } from '../controllers/articleController.js';

// Routes - specific paths must come before /:id wildcard
router.get('/draft/next-id', getNextArticleId);
router.post('/', createArticle);
router.get('/', getArticles);
router.get('/:id', getArticleById);
router.put('/:id', updateArticle);
router.delete('/:id', deleteArticle);

export default router;
