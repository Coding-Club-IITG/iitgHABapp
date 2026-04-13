import apiClient from "./client";

export const getCleaners = async () => {
  const response = await apiClient.get("/room-cleaning/rc/cleaners");
  return response.data.cleaners || [];
};

export const createCleaner = async (name, slots) => {
  const response = await apiClient.post("/room-cleaning/rc/cleaners", {
    name,
    slots,
  });
  return response.data;
};

export const updateCleaner = async (id, name, slots) => {
  const response = await apiClient.put(`/room-cleaning/rc/cleaners/${id}`, {
    name,
    slots,
  });
  return response.data;
};

export const deleteCleaner = async (id) => {
  const response = await apiClient.delete(`/room-cleaning/rc/cleaners/${id}`);
  return response.data;
};

export const getBookingsForDate = async (date) => {
  const response = await apiClient.get("/room-cleaning/rc/tomorrow", {
    params: { date },
  });
  return response.data.bookings || [];
};
