"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft,
  Eye,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/UI/shadcn/button";
import { useVendorOpeningDetails } from "@/hooks/Dashboard/Vendor/useVendorOpenings";

const ACCEPTED_PROFILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
};

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function VendorOpeningDetailsLayout({ openingId }) {
  const [files, setFiles] = useState([]);
  const {
    opening,
    loading,
    uploading,
    error,
    uploadProfiles,
    deleteProfile,
    previewProfile,
  } = useVendorOpeningDetails(openingId);

  const onDrop = (acceptedFiles) => {
    setFiles((currentFiles) => [...currentFiles, ...acceptedFiles]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: ACCEPTED_PROFILE_TYPES,
  });

  const experienceLabel = useMemo(() => {
    if (!opening) return "-";
    if (!opening.experienceRange?.max) {
      return `${opening.experienceRange?.min}+ years`;
    }
    return `${opening.experienceRange.min}-${opening.experienceRange.max} years`;
  }, [opening]);

  const handleUpload = async () => {
    if (files.length === 0) return;
    await uploadProfiles(files);
    setFiles([]);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground">
        <div className="mb-4 h-8 w-40 animate-pulse rounded bg-tableHeader" />
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="h-72 animate-pulse rounded-md border border-border bg-tableHeader" />
          <div className="h-72 animate-pulse rounded-md border border-border bg-tableHeader" />
        </div>
      </main>
    );
  }

  if (!opening) {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground">
        <Link
          className="mb-4 inline-flex items-center gap-2 text-sm text-secondary hover:text-foreground"
          href="/vendor/openings"
        >
          <ArrowLeft className="h-4 w-4" />
          Openings
        </Link>
        <div className="rounded-md border border-border p-6 text-sm text-secondary">
          Opening not found.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="w-full px-4 py-5">
        <Link
          className="mb-4 inline-flex items-center gap-2 text-sm text-secondary hover:text-foreground"
          href="/vendor/openings"
        >
          <ArrowLeft className="h-4 w-4" />
          Openings
        </Link>

        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl font-semibold">{opening.title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-secondary">
              {opening.description || "No description provided."}
            </p>
          </div>
          <span className="w-fit rounded-full border border-border bg-tableHeader px-3 py-1 text-xs text-secondary">
            {opening.status}
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_390px]">
          <section className="rounded-md border border-border">
            <div className="border-b border-border bg-tableHeader px-4 py-3">
              <h2 className="text-sm font-semibold">Opening Details</h2>
            </div>
            <dl className="grid gap-4 p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-secondary">Location</dt>
                <dd className="mt-1 text-sm">{opening.location || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Contract Type</dt>
                <dd className="mt-1 text-sm">{opening.contractType || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Posted Date</dt>
                <dd className="mt-1 text-sm">{formatDate(opening.postedDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Hiring Manager</dt>
                <dd className="mt-1 text-sm">{opening.hiringManagerName}</dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Experience Range</dt>
                <dd className="mt-1 text-sm">{experienceLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Uploaded Profiles</dt>
                <dd className="mt-1 text-sm">{opening.profilesCount}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-md border border-border">
            <div className="border-b border-border bg-tableHeader px-4 py-3">
              <h2 className="text-sm font-semibold">Upload Profiles</h2>
            </div>
            <div className="p-4">
              <div
                {...getRootProps()}
                className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition-colors ${
                  isDragActive
                    ? "border-ring bg-tableHeader"
                    : "border-border hover:bg-tableHeader"
                }`}
              >
                <input {...getInputProps()} />
                <UploadCloud className="mb-3 h-8 w-8 text-secondary" />
                <p className="text-sm text-foreground">
                  Drop PDF/PPTX profiles here
                </p>
                <p className="mt-1 text-xs text-secondary">Multiple files allowed</p>
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-secondary" />
                        <span className="truncate text-sm">{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() =>
                          setFiles((currentFiles) =>
                            currentFiles.filter((_, fileIndex) => fileIndex !== index)
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                className="mt-4 w-full"
                disabled={files.length === 0 || uploading}
                onClick={handleUpload}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                Submit Profiles
              </Button>
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-md border border-border">
          <div className="border-b border-border bg-tableHeader px-4 py-3">
            <h2 className="text-sm font-semibold">Uploaded Profiles</h2>
          </div>
          <div className="divide-y divide-border">
            {opening.uploadedProfiles?.length > 0 ? (
              opening.uploadedProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-secondary" />
                      <p className="truncate text-sm font-medium">
                        {profile.filename}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-secondary">
                      Uploaded {formatDate(profile.submittedAt)} - {profile.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => previewProfile(profile.id)}
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteProfile(profile.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-secondary">
                No profiles uploaded for this opening.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
