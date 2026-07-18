"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getVendorOpeningDetails,
  getVendorOpenings,
  getVendorProfilePreview,
  presignVendorProfiles,
  softDeleteVendorProfile,
  submitVendorProfiles,
  uploadProfileToStorage,
} from "@/utils/Dashboard/Vendor/vendorOpeningsApi";

export function useVendorOpenings(initialPage = 1) {
  const [openings, setOpenings] = useState([]);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOpenings = useCallback(
    async (page) => {
      try {
        setLoading(true);
        setError("");
        const data = await getVendorOpenings({
          page,
          limit: pagination.limit,
        });
        setOpenings(data.items || []);
        setPagination(data.pagination);
      } catch (err) {
        setError(
          err?.response?.data?.message || err.message || "Failed to load openings"
        );
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit]
  );

  useEffect(() => {
    loadOpenings(initialPage);
  }, [initialPage, loadOpenings]);

  return {
    openings,
    pagination,
    loading,
    error,
    loadOpenings,
  };
}

export function useVendorOpeningDetails(openingId) {
  const [opening, setOpening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const loadOpening = useCallback(async () => {
    if (!openingId) return;

    try {
      setLoading(true);
      setError("");
      const data = await getVendorOpeningDetails(openingId);
      setOpening(data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err.message ||
        "Failed to load opening details"
      );
    } finally {
      setLoading(false);
    }
  }, [openingId]);

  useEffect(() => {
    loadOpening();
  }, [loadOpening]);

  const uploadProfiles = async (files) => {
    try {
      setUploading(true);
      setError("");

      const fileMetadata = files.map((file) => ({
        filename: file.name,
        contentType: file.type,
      }));
      const presignedProfiles = await presignVendorProfiles(
        openingId,
        fileMetadata
      );

      await Promise.all(
        presignedProfiles.map((profile, index) =>
          uploadProfileToStorage(profile.uploadUrl, files[index])
        )
      );

      await submitVendorProfiles(
        openingId,
        presignedProfiles.map((profile) => ({
          s3Key: profile.s3Key,
          filename: profile.filename,
          contentType: profile.contentType,
        }))
      );

      await loadOpening();
    } catch (err) {
      setError(
        err?.response?.data?.message || err.message || "Failed to upload files"
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteProfile = async (profileId) => {
    try {
      setError("");
      await softDeleteVendorProfile(openingId, profileId);
      await loadOpening();
    } catch (err) {
      setError(
        err?.response?.data?.message || err.message || "Failed to delete profile"
      );
    }
  };

  const previewProfile = async (profileId) => {
    try {
      setError("");
      const preview = await getVendorProfilePreview(openingId, profileId);
      window.open(preview.previewUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err?.response?.data?.message || err.message || "Failed to preview profile"
      );
    }
  };

  return {
    opening,
    loading,
    uploading,
    error,
    uploadProfiles,
    deleteProfile,
    previewProfile,
    reload: loadOpening,
  };
}
