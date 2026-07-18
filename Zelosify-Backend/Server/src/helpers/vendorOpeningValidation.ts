import { sanitizeFilename } from "./vendorRequestValidation.js";

export const ALLOWED_PROFILE_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export interface ProfileFileInput {
  filename: string;
  contentType: string;
}

export interface SubmittedProfileInput extends ProfileFileInput {
  s3Key: string;
}

export function parsePagination(pageValue: unknown, limitValue: unknown) {
  const page = Math.max(Number(pageValue) || 1, 1);
  const limit = Math.min(Math.max(Number(limitValue) || 10, 1), 50);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function validateProfileFiles(files: unknown): {
  isValid: boolean;
  errors: string[];
  files: ProfileFileInput[];
} {
  if (!Array.isArray(files) || files.length === 0) {
    return {
      isValid: false,
      errors: ["At least one file is required."],
      files: [],
    };
  }

  const errors: string[] = [];
  const parsedFiles: ProfileFileInput[] = [];

  files.forEach((file, index) => {
    const profileFile = file as Partial<ProfileFileInput>;
    const filename =
      typeof profileFile.filename === "string"
        ? sanitizeFilename(profileFile.filename)
        : "";
    const contentType =
      typeof profileFile.contentType === "string" ? profileFile.contentType : "";

    if (!filename) {
      errors.push(`files[${index}].filename is required.`);
    }

    if (!ALLOWED_PROFILE_CONTENT_TYPES.has(contentType)) {
      errors.push(`files[${index}].contentType must be PDF or PPTX.`);
    }

    if (filename && contentType) {
      parsedFiles.push({ filename, contentType });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    files: parsedFiles,
  };
}

export function validateSubmittedProfiles(profiles: unknown): {
  isValid: boolean;
  errors: string[];
  profiles: SubmittedProfileInput[];
} {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return {
      isValid: false,
      errors: ["At least one profile is required."],
      profiles: [],
    };
  }

  const errors: string[] = [];
  const parsedProfiles: SubmittedProfileInput[] = [];

  profiles.forEach((profile, index) => {
    const submittedProfile = profile as Partial<SubmittedProfileInput>;
    const filename =
      typeof submittedProfile.filename === "string"
        ? sanitizeFilename(submittedProfile.filename)
        : "";
    const contentType =
      typeof submittedProfile.contentType === "string"
        ? submittedProfile.contentType
        : "";
    const s3Key =
      typeof submittedProfile.s3Key === "string" ? submittedProfile.s3Key : "";

    if (!filename) {
      errors.push(`profiles[${index}].filename is required.`);
    }

    if (!ALLOWED_PROFILE_CONTENT_TYPES.has(contentType)) {
      errors.push(`profiles[${index}].contentType must be PDF or PPTX.`);
    }

    if (!s3Key) {
      errors.push(`profiles[${index}].s3Key is required.`);
      return;
    }

    if (filename && ALLOWED_PROFILE_CONTENT_TYPES.has(contentType)) {
      parsedProfiles.push({
        filename,
        contentType,
        s3Key,
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    profiles: parsedProfiles,
  };
}
