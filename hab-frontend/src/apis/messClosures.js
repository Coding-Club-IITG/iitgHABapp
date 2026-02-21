import axios from "axios";
import { BACKEND_URL } from "./server";

export const getAllMessClosures = async (filters = {}) => {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "" && v !== undefined))
  ).toString();
  const url = `${BACKEND_URL}/hostel/closure${params ? `?${params}` : ""}`;
  const response = await axios.get(url);
  return response.data;
};

export const createMessClosure = async (data) => {
  const response = await axios.post(`${BACKEND_URL}/hostel/closure`, data);
  return response.data;
};

export const updateMessClosure = async (id, data) => {
  const response = await axios.put(`${BACKEND_URL}/hostel/closure/${id}`, data);
  return response.data;
};

export const deleteMessClosure = async (id) => {
  const response = await axios.delete(`${BACKEND_URL}/hostel/closure/${id}`);
  return response.data;
};