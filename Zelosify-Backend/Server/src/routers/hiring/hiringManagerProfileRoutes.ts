import { Router, type RequestHandler } from 'express';
import { authenticateUser } from '../../middlewares/auth/authenticateMiddleware.js';
import { authorizeRole } from '../../middlewares/auth/authorizeMiddleware.js';
import { shortlistHiringProfile, rejectHiringProfile } from '../../controllers/hiring/profiles/hiringManagerProfileController.js';

const router = Router();

router.use(authenticateUser as RequestHandler, authorizeRole('HIRING_MANAGER') as RequestHandler);

router.post('/:id/shortlist', shortlistHiringProfile as RequestHandler);
router.post('/:id/reject', rejectHiringProfile as RequestHandler);

export default router;
