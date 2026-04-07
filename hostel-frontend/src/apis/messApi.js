import apiClient from "./client";

export const getMessWorkers = async () => {
  const response = await apiClient.get("/mess/workers");
  return response.data.workers || [];
};

export const createMessWorker = async (workerData) => {
  const response = await apiClient.post("/mess/workers", workerData);
  return response.data;
};

export const deleteMessWorker = async (id) => {
  const response = await apiClient.delete(`/mess/workers/${id}`);
  return response.data;
};

export const generateMessBill = async (billData, hostelId) => {
  const response = await apiClient.post("/mess/bill/generate", { billData, hostelId });
  return response.data;
};

export const fetchMessBill = async (hostelId, month, year) => {
  const response = await apiClient.get(`/mess/bill`, {
    params: { hostelId, month, year }
  });
  return response.data;
};

export const getRebateSummary = async (month, year) => {
  const response = await apiClient.get('/leave/hostel/rebate-summary', {
    params: { month, year }
  });
  return response.data;
};
