import apiClient from "./client";

export const getBoarders = async () => {
  const response = await apiClient.get("/hostel/boarders");
  return response.data.boarders || [];
};

/**
 * @param {{ month?: number, year?: number, snapshot?: boolean }} [opts]
 * Omit args for live data (UserAllocHostel + User).
 * Pass month, year, and snapshot: true to load MessSubscribersSnapshot for that month (even if it is the current calendar month).
 */
export const getMessSubscribers = async (opts = {}) => {
  const { month, year, snapshot } = opts;
  const params = {};
  if (month != null && year != null && snapshot) {
    params.month = month;
    params.year = year;
    params.snapshot = "1";
  }
  const response = await apiClient.get("/hostel/mess-subscribers", { params });
  return response.data;
};

export const getMessSubscribersSnapshotMonths = async () => {
  const response = await apiClient.get("/hostel/mess-subscribers/snapshot-months");
  return response.data;
};

export const getMessSubscribersCountByMonth = async (month, year) => {
  const response = await apiClient.get("/hostel/mess-subscribers/count", {
    params: { month, year },
  });
  return response.data;
};

export const getCatererInfo = async () => {
  const response = await apiClient.get("/hostel/caterer-info");
  return response.data;
};

export const getSMCMembers = async () => {
  const response = await apiClient.get("/hostel/smc-members");
  return response.data.smcMembers || [];
};

export const markAsSMC = async (userId) => {
  const response = await apiClient.post("/hostel/mark-smc", { userId });
  return response.data;
};

export const unmarkAsSMC = async (userId) => {
  const response = await apiClient.post("/hostel/unmark-smc", { userId });
  return response.data;
};
