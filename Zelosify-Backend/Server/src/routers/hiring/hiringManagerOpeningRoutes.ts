import { Router, type RequestHandler } from 'express';
import { authenticateUser } from '../../middlewares/auth/authenticateMiddleware.js';
import { authorizeRole } from '../../middlewares/auth/authorizeMiddleware.js';
import { fetchHiringManagerOpenings, fetchHiringManagerOpeningProfiles } from '../../controllers/hiring/openings/hiringManagerOpeningController.js';

const router = Router();

router.use(authenticateUser as RequestHandler, authorizeRole('HIRING_MANAGER') as RequestHandler);

router.get('/', fetchHiringManagerOpenings as RequestHandler);
router.get('/:id/profiles', fetchHiringManagerOpeningProfiles as RequestHandler);

export default router;
