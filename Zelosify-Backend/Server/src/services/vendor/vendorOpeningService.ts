import prisma from "../../config/prisma/prisma.js";
import { createStorageService } from "../storage/storageFactory.js";
import { triggerRecommendationForProfile } from '../agent/recommendationService.js';
import {
  ProfileFileInput,
  SubmittedProfileInput,
  parsePagination,
} from "../../helpers/vendorOpeningValidation.js";

export class VendorOpeningError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

interface VendorContext {
  userId: string;
  tenantId: string;
}

export class VendorOpeningService {
  async listOpenings(vendor: VendorContext, pageValue: unknown, limitValue: unknown) {
    const pagination = parsePagination(pageValue, limitValue);

    const where = {
      tenantId: vendor.tenantId,
      status: "OPEN" as const,
    };

    const [openings, total] = await prisma.$transaction([
      prisma.opening.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { postedDate: "desc" },
        select: {
          id: true,
          title: true,
          location: true,
          contractType: true,
          postedDate: true,
          hiringManagerId: true,
          experienceMin: true,
          experienceMax: true,
          status: true,
        },
      }),
      prisma.opening.count({ where }),
    ]);

    const hiringManagerIds = [
      ...new Set(openings.map((opening) => opening.hiringManagerId)),
    ];
    const hiringManagers = await prisma.user.findMany({
      where: { id: { in: hiringManagerIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const managerById = new Map(
      hiringManagers.map((manager) => [manager.id, this.formatUserName(manager)])
    );

    return {
      items: openings.map((opening) => ({
        ...opening,
        hiringManagerName:
          managerById.get(opening.hiringManagerId) || "Unassigned Manager",
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async getOpeningDetails(vendor: VendorContext, openingId: string) {
    const opening = await prisma.opening.findFirst({
      where: {
        id: openingId,
        tenantId: vendor.tenantId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        contractType: true,
        hiringManagerId: true,
        experienceMin: true,
        experienceMax: true,
        postedDate: true,
        expectedCompletionDate: true,
        actionDate: true,
        status: true,
        hiringProfiles: {
          where: {
            uploadedBy: vendor.userId,
            isDeleted: false,
          },
          orderBy: { submittedAt: "desc" },
          select: {
            id: true,
            s3Key: true,
            submittedAt: true,
            status: true,
          },
        },
      },
    });

    if (!opening) {
      throw new VendorOpeningError(404, "Opening not found");
    }

    const hiringManager = await prisma.user.findUnique({
      where: { id: opening.hiringManagerId },
      select: { firstName: true, lastName: true, email: true },
    });

    const uploadedProfiles = opening.hiringProfiles.map((profile) => ({
      ...profile,
      filename: this.getFilenameFromS3Key(profile.s3Key),
    }));

    return {
      ...opening,
      hiringProfiles: undefined,
      hiringManagerName: hiringManager
        ? this.formatUserName(hiringManager)
        : "Unassigned Manager",
      experienceRange: {
        min: opening.experienceMin,
        max: opening.experienceMax,
      },
      profilesCount: uploadedProfiles.length,
      uploadedProfiles,
    };
  }

  async presignProfileUploads(
    vendor: VendorContext,
    openingId: string,
    files: ProfileFileInput[]
  ) {
    await this.assertOpeningBelongsToTenant(vendor.tenantId, openingId);

    const storageService = createStorageService();
    const timestamp = Date.now();

    return Promise.all(
      files.map(async (file, index) => {
        const s3Key = `${vendor.tenantId}/${openingId}/${timestamp + index}_${
          file.filename
        }`;
        const uploadUrl = await storageService.getUploadURL(
          s3Key,
          file.contentType
        );

        return {
          filename: file.filename,
          contentType: file.contentType,
          s3Key,
          uploadUrl,
        };
      })
    );
  }

  async submitProfiles(
    vendor: VendorContext,
    openingId: string,
    profiles: SubmittedProfileInput[]
  ) {
    await this.assertOpeningBelongsToTenant(vendor.tenantId, openingId);

    const expectedPrefix = `${vendor.tenantId}/${openingId}/`;
    const invalidProfile = profiles.find(
      (profile) => !profile.s3Key.startsWith(expectedPrefix)
    );

    if (invalidProfile) {
      throw new VendorOpeningError(400, "Invalid profile storage key");
    }

    const createdProfiles = await prisma.$transaction(async (tx) => {
      const createdProfiles = [];

      for (const profile of profiles) {
        const createdProfile = await tx.hiringProfile.create({
          data: {
            openingId,
            s3Key: profile.s3Key,
            uploadedBy: vendor.userId,
            status: "SUBMITTED",
            isDeleted: false,
          },
          select: {
            id: true,
            s3Key: true,
            submittedAt: true,
            status: true,
          },
        });

        createdProfiles.push({
          ...createdProfile,
          filename: this.getFilenameFromS3Key(createdProfile.s3Key),
        });
      }

      return createdProfiles;
    });

    // Fire-and-forget: trigger AI recommendation asynchronously
    setImmediate(() => {
      for (const profile of createdProfiles) {
        triggerRecommendationForProfile(profile.id, openingId).catch(() => {});
      }
    });

    return createdProfiles;
  }

  async softDeleteProfile(
    vendor: VendorContext,
    openingId: string,
    profileId: number
  ) {
    await this.assertOpeningBelongsToTenant(vendor.tenantId, openingId);

    const profile = await prisma.hiringProfile.findFirst({
      where: {
        id: profileId,
        openingId,
        uploadedBy: vendor.userId,
        isDeleted: false,
      },
    });

    if (!profile) {
      throw new VendorOpeningError(404, "Profile not found");
    }

    return prisma.hiringProfile.update({
      where: { id: profileId },
      data: { isDeleted: true },
      select: {
        id: true,
        s3Key: true,
        isDeleted: true,
      },
    });
  }

  async getProfilePreviewUrl(
    vendor: VendorContext,
    openingId: string,
    profileId: number
  ) {
    await this.assertOpeningBelongsToTenant(vendor.tenantId, openingId);

    const profile = await prisma.hiringProfile.findFirst({
      where: {
        id: profileId,
        openingId,
        uploadedBy: vendor.userId,
        isDeleted: false,
      },
      select: {
        id: true,
        s3Key: true,
      },
    });

    if (!profile) {
      throw new VendorOpeningError(404, "Profile not found");
    }

    const storageService = createStorageService();
    const previewUrl = await storageService.getObjectURL(profile.s3Key);

    return {
      id: profile.id,
      filename: this.getFilenameFromS3Key(profile.s3Key),
      previewUrl,
    };
  }

  private async assertOpeningBelongsToTenant(tenantId: string, openingId: string) {
    const opening = await prisma.opening.findFirst({
      where: {
        id: openingId,
        tenantId,
      },
      select: { id: true },
    });

    if (!opening) {
      throw new VendorOpeningError(404, "Opening not found");
    }
  }

  private formatUserName(user: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  }) {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return fullName || user.email || "Unknown User";
  }

  private getFilenameFromS3Key(s3Key: string) {
    const filename = s3Key.split("/").pop() || s3Key;
    return filename.replace(/^\d+_/, "");
  }
}
