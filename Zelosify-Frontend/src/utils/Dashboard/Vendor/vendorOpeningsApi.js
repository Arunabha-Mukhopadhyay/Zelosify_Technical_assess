import axiosInstance from "@/utils/Axios/AxiosInstance";

export async function getVendorOpenings(params = {}) {
  const response = await axiosInstance.get("/vendor/openings", { params });
  return response.data.data;
}

export async function getVendorOpeningDetails(id) {
  const response = await axiosInstance.get(`/vendor/openings/${id}`);
  return response.data.data;
}

export async function presignVendorProfiles(openingId, files) {
  const response = await axiosInstance.post(
    `/vendor/openings/${openingId}/profiles/presign`,
    { files }
  );
  return response.data.data;
}

export async function uploadProfileToStorage(uploadUrl, file) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed for ${file.name}`);
  }
}

export async function submitVendorProfiles(openingId, profiles) {
  const response = await axiosInstance.post(
    `/vendor/openings/${openingId}/profiles/upload`,
    { profiles }
  );
  return response.data.data;
}

export async function softDeleteVendorProfile(openingId, profileId) {
  const response = await axiosInstance.delete(
    `/vendor/openings/${openingId}/profiles/${profileId}`
  );
  return response.data.data;
}

export async function getVendorProfilePreview(openingId, profileId) {
  const response = await axiosInstance.get(
    `/vendor/openings/${openingId}/profiles/${profileId}/preview`
  );
  return response.data.data;
}
