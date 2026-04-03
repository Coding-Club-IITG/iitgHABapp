import apiClient from "./client";

export const getBoarders = async () => {
  const response = await apiClient.get("/hostel/boarders");
  return response.data.boarders || [];
};

export const getMessSubscribers = async () => {
  const response = await apiClient.get("/hostel/mess-subscribers");
  return response.data.subscribers || [];
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
