import axiosInstance from '@/utils/Axios/AxiosInstance';

export async function getHiringManagerOpenings() {
  const response = await axiosInstance.get('/hiring-manager/openings');
  return response.data.data;
}

export async function getHiringManagerOpeningProfiles(openingId) {
  const response = await axiosInstance.get(`/hiring-manager/openings/${openingId}/profiles`);
  return response.data.data;
}

export async function shortlistProfile(profileId) {
  const response = await axiosInstance.post(`/hiring-manager/profiles/${profileId}/shortlist`);
  return response.data.data;
}

export async function rejectProfile(profileId) {
  const response = await axiosInstance.post(`/hiring-manager/profiles/${profileId}/reject`);
  return response.data.data;
}
