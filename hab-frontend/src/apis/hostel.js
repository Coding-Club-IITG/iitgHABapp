import axios from "axios";
import { BACKEND_URL } from "./server";

// Get all hostels
export const getAllHostels = async () => {
  try {
    const response = await axios.get(`${BACKEND_URL}/hostel/all`);
    return response.data;
  } catch (error) {
    console.error("Error fetching hostels:", error);
    throw error;
  }
};

// Get all hostel names and caterer info
export const getAllHostelNamesAndCaterers = async () => {
  try {
    const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await axios.post(`${BACKEND_URL}/hostel/gethnc`, {}, { headers });
    return response.data;
  } catch (error) {
    console.error("Error fetching hostel names and caterers:", error);
    throw error;
  }
};

// Get hostel by ID with users
export const getHostelById = async (hostelId) => {
  try {
    const response = await axios.get(
      `${BACKEND_URL}/hostel/all/hab/${hostelId}`,
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching hostel ${hostelId}:`, error);
    throw error;
  }
};

export const getMessSubscribersByHostelId = async (hostelId) => {
  try {
    const response = await axios.get(
      `${BACKEND_URL}/hostel/mess-subscribers/${hostelId}`,
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching mess subscribers for ${hostelId}:`, error);
    throw error;
  }
};

// Create new hostel
export const createHostel = async (hostelData) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/hostel/`, hostelData);
    return response.data;
  } catch (error) {
    console.error("Error creating hostel:", error);
    throw error;
  }
};

// Update hostel
export const updateHostel = async (hostelId, hostelData) => {
  try {
    const response = await axios.put(
      `${BACKEND_URL}/hostel/update/${hostelId}`,
      hostelData,
    );
    return response.data;
  } catch (error) {
    console.error(`Error updating hostel ${hostelId}:`, error);
    throw error;
  }
};

export const getAllocations = async (page = 1, search = "") => {
  try {
    const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await axios.get(
      `${BACKEND_URL}/hostel/allocations?page=${page}&limit=50&search=${search}`,
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching allocations:", error);
    throw error;
  }
};

export const updateAllocation = async (id, email) => {
  try {
    const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await axios.put(
      `${BACKEND_URL}/hostel/allocations/${id}`,
      { email },
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating allocation:", error);
    throw error;
  }
};

export const upsertAllocation = async ({
  rollno,
  hostelId,
  currentSubscribedMessId,
  email,
}) => {
  try {
    const token =
      localStorage.getItem("admin_token") || localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await axios.post(
      `${BACKEND_URL}/hostel/allocations/upsert`,
      { rollno, hostelId, currentSubscribedMessId, email },
      { headers },
    );
    return response.data;
  } catch (error) {
    console.error("Error upserting allocation:", error);
    throw error;
  }
};
