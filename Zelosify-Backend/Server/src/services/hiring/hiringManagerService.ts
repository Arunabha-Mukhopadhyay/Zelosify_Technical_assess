import prisma from '../../config/prisma/prisma.js';
import { logger } from '../../utils/logger/structuredLogger.js';

export class HiringManagerError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

type RecommendationBadge = 'RECOMMENDED' | 'BORDERLINE' | 'NOT_RECOMMENDED' | 'PENDING';

function getBadge(recommended: boolean | null, score: number | null): RecommendationBadge {
  if (recommended === null || recommended === undefined) return 'PENDING';
  if (recommended === true) return 'RECOMMENDED';
  if (score !== null && score >= 0.5) return 'BORDERLINE';
  return 'NOT_RECOMMENDED';
}

function getFilenameFromS3Key(s3Key: string): string {
  const filename = s3Key.split('/').pop() || s3Key;
  return filename.replace(/^\d+_/, '');
}

export class HiringManagerService {
  async listOwnOpenings(managerId: string) {
    const openings = await prisma.opening.findMany({
      where: { hiringManagerId: managerId },
      orderBy: { postedDate: 'desc' },
      select: {
        id: true,
        title: true,
        location: true,
        contractType: true,
        postedDate: true,
        status: true,
        experienceMin: true,
        experienceMax: true,
        hiringProfiles: {
          where: { isDeleted: false },
          select: { status: true },
        },
      },
    });

    return openings.map((opening) => {
      const profiles = opening.hiringProfiles;
      return {
        ...opening,
        hiringProfiles: undefined,
        profilesCount: profiles.length,
        submittedCount: profiles.filter(p => p.status === 'SUBMITTED').length,
        shortlistedCount: profiles.filter(p => p.status === 'SHORTLISTED').length,
        rejectedCount: profiles.filter(p => p.status === 'REJECTED').length,
      };
    });
  }

  async listProfilesForOpening(managerId: string, openingId: string) {
    const opening = await prisma.opening.findUnique({
      where: { id: openingId },
      select: { id: true, title: true, description: true, location: true, contractType: true, experienceMin: true, experienceMax: true, status: true, hiringManagerId: true, postedDate: true },
    });

    if (!opening) throw new HiringManagerError(404, 'Opening not found');
    if (opening.hiringManagerId !== managerId) throw new HiringManagerError(403, 'Access denied: this opening belongs to another manager');

    const profiles = await prisma.hiringProfile.findMany({
      where: { openingId, isDeleted: false },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        s3Key: true,
        uploadedBy: true,
        submittedAt: true,
        status: true,
        recommended: true,
        recommendationScore: true,
        recommendationReason: true,
        recommendationLatencyMs: true,
        recommendationConfidence: true,
        recommendedAt: true,
      },
    });

    const enrichedProfiles = profiles.map((profile) => ({
      ...profile,
      filename: getFilenameFromS3Key(profile.s3Key),
      recommendationBadge: getBadge(profile.recommended, profile.recommendationScore),
    }));

    return {
      opening,
      profiles: enrichedProfiles,
    };
  }

  async shortlistProfile(managerId: string, profileId: number) {
    const profile = await this.assertProfileBelongsToManager(managerId, profileId);

    logger.info('[HiringManagerService] Shortlisting profile', { profileId, managerId });

    return prisma.$transaction(async (tx) => {
      return tx.hiringProfile.update({
        where: { id: profileId },
        data: {
          status: 'SHORTLISTED',
          shortlistedBy: managerId,
          shortlistedAt: new Date(),
        },
        select: { id: true, status: true, shortlistedAt: true },
      });
    });
  }

  async rejectProfile(managerId: string, profileId: number) {
    await this.assertProfileBelongsToManager(managerId, profileId);

    logger.info('[HiringManagerService] Rejecting profile', { profileId, managerId });

    return prisma.$transaction(async (tx) => {
      return tx.hiringProfile.update({
        where: { id: profileId },
        data: {
          status: 'REJECTED',
          rejectedBy: managerId,
          rejectedAt: new Date(),
        },
        select: { id: true, status: true, rejectedAt: true },
      });
    });
  }

  private async assertProfileBelongsToManager(managerId: string, profileId: number) {
    const profile = await prisma.hiringProfile.findFirst({
      where: { id: profileId, isDeleted: false },
      include: { opening: { select: { hiringManagerId: true } } },
    });

    if (!profile) throw new HiringManagerError(404, 'Profile not found');
    if (profile.opening.hiringManagerId !== managerId) throw new HiringManagerError(403, 'Access denied: profile belongs to another manager opening');

    return profile;
  }
}
