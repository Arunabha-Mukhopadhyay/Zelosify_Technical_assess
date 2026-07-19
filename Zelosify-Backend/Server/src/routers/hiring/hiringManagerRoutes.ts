import express from 'express';
import hiringManagerOpeningRoutes from './hiringManagerOpeningRoutes.js';
import hiringManagerProfileRoutes from './hiringManagerProfileRoutes.js';

const router = express.Router();

router.use('/openings', hiringManagerOpeningRoutes);
router.use('/profiles', hiringManagerProfileRoutes);

export default router;
