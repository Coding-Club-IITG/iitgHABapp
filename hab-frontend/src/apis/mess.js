import axios from "axios";
import { BACKEND_URL } from "./server";

// Get all mess/caterer information
export const getAllMesses = async () => {
  try {
    const response = await axios.post(`${BACKEND_URL}/mess/all`);
    return response.data;
  } catch (error) {
    console.error("Error fetching messes:", error);
    throw error;
  }
};

// Get specific mess information by ID
export const getMessById = async (messId) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/mess/${messId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching mess ${messId}:`, error);
    throw error;
  }
};

// Create new mess without hostel
export const createMessWithoutHostel = async (messData) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/mess/create-without-hostel`,
      messData
    );
    return response.data;
  } catch (error) {
    console.error("Error creating mess:", error);
    throw error;
  }
};

// Create new mess with hostel
export const createMess = async (messData) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/mess/create`, messData);
    return response.data;
  } catch (error) {
    console.error("Error creating mess with hostel:", error);
    throw error;
  }
};

// Delete mess
// (Delete mess endpoint removed) - function removed to disable deletion from frontend

// Get unassigned messes
export const getUnassignedMesses = async () => {
  try {
    const response = await axios.post(`${BACKEND_URL}/mess/unassigned`);
    return response.data;
  } catch (error) {
    console.error("Error fetching unassigned messes:", error);
    throw error;
  }
};

// Assign mess to hostel
export const assignMessToHostel = async (messId, assignmentData) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/mess/reassign/${messId}`,
      assignmentData
    );
    return response.data;
  } catch (error) {
    console.error(`Error assigning mess ${messId} to hostel:`, error);
    throw error;
  }
};

// Change hostel for mess
export const changeMessHostel = async (messId, changeData) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/mess/change-hostel/${messId}`,
      changeData
    );
    return response.data;
  } catch (error) {
    console.error(`Error changing hostel for mess ${messId}:`, error);
    throw error;
  }
};

// Unassign mess from hostel
export const unassignMess = async (messId) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/mess/unassign/${messId}`);
    return response.data;
  } catch (error) {
    console.error(`Error unassigning mess ${messId}:`, error);
    throw error;
  }
};

// Get mess menu by day
export const getMessMenuByDay = async (messId, day, token) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/mess/hab-menu/${messId}`,
      { day },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching menu for mess ${messId}:`, error);
    throw error;
  }
};

// Get all mess bills for a specific month
export const getAllBillsByMonth = async (month, year) => {
  try {
    const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
    const response = await axios.get(
      `${BACKEND_URL}/mess/bills/all?month=${month}&year=${year}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching bills for ${month} ${year}:`, error);
    throw error;
  }
};
