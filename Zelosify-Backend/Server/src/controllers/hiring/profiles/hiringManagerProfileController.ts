import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../../types/typeIndex.js';
import { HiringManagerError, HiringManagerService } from '../../../services/hiring/hiringManagerService.js';

const hiringManagerService = new HiringManagerService();

function handleError(error: unknown, res: Response) {
  if (error instanceof HiringManagerError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  console.error('[HiringManager] Profile action error:', error);
  res.status(500).json({ message: 'Internal server error' });
}

function parseProfileId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return isNaN(id) || id <= 0 ? null : id;
}

export async function shortlistHiringProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const managerId = req.user?.id;
    if (!managerId) { res.status(401).json({ message: 'Authenticated user required' }); return; }
    const profileId = parseProfileId(req.params.id);
    if (!profileId) { res.status(400).json({ message: 'Invalid profile id' }); return; }
    const data = await hiringManagerService.shortlistProfile(managerId, profileId);
    res.status(200).json({ message: 'Profile shortlisted', data });
  } catch (error) {
    handleError(error, res);
  }
}

export async function rejectHiringProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const managerId = req.user?.id;
    if (!managerId) { res.status(401).json({ message: 'Authenticated user required' }); return; }
    const profileId = parseProfileId(req.params.id);
    if (!profileId) { res.status(400).json({ message: 'Invalid profile id' }); return; }
    const data = await hiringManagerService.rejectProfile(managerId, profileId);
    res.status(200).json({ message: 'Profile rejected', data });
  } catch (error) {
    handleError(error, res);
  }
}
