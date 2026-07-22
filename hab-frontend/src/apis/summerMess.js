import axios from "axios";

import { BACKEND_URL } from "./server";

function getAuthHeaders() {
  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getSummerMessSettings(params = {}) {
  const response = await axios.get(`${BACKEND_URL}/summer-mess/settings`, {
    headers: getAuthHeaders(),
    params,
  });
  return response.data;
}

export async function saveSummerMessSettings(payload) {
  const response = await axios.post(
    `${BACKEND_URL}/summer-mess/settings`,
    payload,
    {
      headers: getAuthHeaders(),
    },
  );
  return response.data;
}

export async function openSummerMessRegistration(payload = {}) {
  const response = await axios.post(
    `${BACKEND_URL}/summer-mess/settings/open-registration`,
    payload,
    {
      headers: getAuthHeaders(),
    },
  );
  return response.data;
}

export async function closeSummerMessRegistration(payload = {}) {
  const response = await axios.post(
    `${BACKEND_URL}/summer-mess/settings/close-registration`,
    payload,
    {
      headers: getAuthHeaders(),
    },
  );
  return response.data;
}

export async function activateSummerMess(payload = {}) {
  const response = await axios.post(
    `${BACKEND_URL}/summer-mess/activate`,
    payload,
    {
      headers: getAuthHeaders(),
    },
  );
  return response.data;
}

export async function restoreSummerMess() {
  const response = await axios.post(
    `${BACKEND_URL}/summer-mess/restore`,
    {},
    {
      headers: getAuthHeaders(),
    },
  );
  return response.data;
}

export async function deleteSummerMessSeason(seasonId) {
  const response = await axios.delete(
    `${BACKEND_URL}/summer-mess/settings/${seasonId}`,
    {
      headers: getAuthHeaders(),
    },
  );
  return response.data;
}

export async function getSummerMessAdminApplications(params = {}) {
  const response = await axios.get(
    `${BACKEND_URL}/summer-mess/admin/applications`,
    {
      headers: getAuthHeaders(),
      params,
    },
  );
  return response.data;
}
