// ==============================================================================
// ExamSphere – Question Bank Routes
// ==============================================================================

import { Router } from 'express';
import multer from 'multer';
import {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  bulkImportQuestions,
  exportQuestions,
} from './questions.controller.js';
import {
  createQuestionSchema,
  updateQuestionSchema,
  queryQuestionsSchema,
} from './questions.validation.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit for bulk imports
});

const router = Router();

// Question Bank management requires authenticated FACULTY or ADMIN roles
router.use(authenticateUser);
router.use(authorizeRoles('FACULTY', 'ADMIN'));

router.get('/', validateRequest(queryQuestionsSchema, 'query'), getQuestions);
router.get('/export', exportQuestions);
router.post('/import', upload.single('file'), bulkImportQuestions);

router.post('/', validateRequest(createQuestionSchema), createQuestion);
router.get('/:id', getQuestionById);
router.put('/:id', validateRequest(updateQuestionSchema), updateQuestion);
router.delete('/:id', deleteQuestion);

export default router;
