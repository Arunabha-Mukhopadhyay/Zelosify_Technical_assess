import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../types/typeIndex.js";
import {
  validateProfileFiles,
  validateSubmittedProfiles,
} from "../../../helpers/vendorOpeningValidation.js";
import {
  VendorOpeningError,
  VendorOpeningService,
} from "../../../services/vendor/vendorOpeningService.js";

const vendorOpeningService = new VendorOpeningService();

function getVendorContext(req: AuthenticatedRequest) {
  const userId = req.user?.id;
  const tenantId = req.user?.tenant?.tenantId;

  if (!userId || !tenantId) {
    throw new VendorOpeningError(401, "Authenticated tenant user required");
  }

  return { userId, tenantId };
}

function handleVendorOpeningError(error: unknown, res: Response) {
  if (error instanceof VendorOpeningError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error("[Vendor Openings] Unexpected error:", error);
  res.status(500).json({ message: "Internal server error" });
}

export async function fetchVendorOpenings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const vendor = getVendorContext(req);
    const data = await vendorOpeningService.listOpenings(
      vendor,
      req.query.page,
      req.query.limit
    );

    res.status(200).json({ message: "Openings fetched", data });
  } catch (error) {
    handleVendorOpeningError(error, res);
  }
}

export async function fetchVendorOpeningDetails(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const vendor = getVendorContext(req);
    const data = await vendorOpeningService.getOpeningDetails(
      vendor,
      req.params.id
    );

    res.status(200).json({ message: "Opening details fetched", data });
  } catch (error) {
    handleVendorOpeningError(error, res);
  }
}

export async function presignVendorProfileUploads(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const validation = validateProfileFiles(req.body.files);

    if (!validation.isValid) {
      res.status(400).json({
        message: "Invalid profile files",
        errors: validation.errors,
      });
      return;
    }

    const vendor = getVendorContext(req);
    const data = await vendorOpeningService.presignProfileUploads(
      vendor,
      req.params.id,
      validation.files
    );

    res.status(200).json({ message: "Upload URLs generated", data });
  } catch (error) {
    handleVendorOpeningError(error, res);
  }
}

export async function submitVendorProfiles(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const validation = validateSubmittedProfiles(req.body.profiles);

    if (!validation.isValid) {
      res.status(400).json({
        message: "Invalid submitted profiles",
        errors: validation.errors,
      });
      return;
    }

    const vendor = getVendorContext(req);
    const data = await vendorOpeningService.submitProfiles(
      vendor,
      req.params.id,
      validation.profiles
    );

    res.status(201).json({ message: "Profiles submitted", data });
  } catch (error) {
    handleVendorOpeningError(error, res);
  }
}

export async function softDeleteVendorProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const profileId = parseInt(req.params.profileId, 10);

    if (isNaN(profileId) || profileId <= 0) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }

    const vendor = getVendorContext(req);
    const data = await vendorOpeningService.softDeleteProfile(
      vendor,
      req.params.openingId,
      profileId
    );

    res.status(200).json({ message: "Profile deleted", data });
  } catch (error) {
    handleVendorOpeningError(error, res);
  }
}

export async function previewVendorProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const profileId = parseInt(req.params.profileId, 10);

    if (isNaN(profileId) || profileId <= 0) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }

    const vendor = getVendorContext(req);
    const data = await vendorOpeningService.getProfilePreviewUrl(
      vendor,
      req.params.openingId,
      profileId
    );

    res.status(200).json({ message: "Profile preview fetched", data });
  } catch (error) {
    handleVendorOpeningError(error, res);
  }
}
