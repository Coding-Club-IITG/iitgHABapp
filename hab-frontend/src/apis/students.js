import axios from "axios";
import { BACKEND_URL } from "./server";

export const getStudents = async () => {
  try {
    const token =
      localStorage.getItem("token") || localStorage.getItem("admin_token");
    const alternateToken =
      token === localStorage.getItem("token")
        ? localStorage.getItem("admin_token")
        : localStorage.getItem("token");

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let response;
    try {
      response = await axios.get(`${BACKEND_URL}/users/all/hab`, { headers });
    } catch (error) {
      if (
        error?.response?.status === 403 &&
        alternateToken &&
        alternateToken !== token
      ) {
        response = await axios.get(`${BACKEND_URL}/users/all/hab`, {
          headers: { Authorization: `Bearer ${alternateToken}` },
        });
      } else {
        throw error;
      }
    }

    return response.data;
  } catch (error) {
    console.error("Error fetching students:", error);
    throw error;
  }
};
