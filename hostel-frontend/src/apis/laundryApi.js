import apiClient from "./client";

export const getLaundryDashboard = async () => {
  const response = await apiClient.get("/laundry/hostel/dashboard");
  return response.data;
};
