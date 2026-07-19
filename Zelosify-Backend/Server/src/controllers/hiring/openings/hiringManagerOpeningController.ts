import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../../types/typeIndex.js';
import { HiringManagerError, HiringManagerService } from '../../../services/hiring/hiringManagerService.js';

const hiringManagerService = new HiringManagerService();

function handleError(error: unknown, res: Response) {
  if (error instanceof HiringManagerError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  console.error('[HiringManager] Unexpected error:', error);
  res.status(500).json({ message: 'Internal server error' });
}

export async function fetchHiringManagerOpenings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const managerId = req.user?.id;
    if (!managerId) { res.status(401).json({ message: 'Authenticated user required' }); return; }
    const { page, limit } = req.query;
    const data = await hiringManagerService.listOwnOpenings(managerId, page, limit);
    res.status(200).json({ message: 'Openings fetched', data });
  } catch (error) {
    handleError(error, res);
  }
}

export async function fetchHiringManagerOpeningProfiles(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const managerId = req.user?.id;
    if (!managerId) { res.status(401).json({ message: 'Authenticated user required' }); return; }
    const data = await hiringManagerService.listProfilesForOpening(managerId, req.params.id);
    res.status(200).json({ message: 'Profiles fetched', data });
  } catch (error) {
    handleError(error, res);
  }
}
