import { BACKEND_URL } from "./server";

function authHeaders() {
  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${BACKEND_URL}/events${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

export const listEvents = () => request("/admin");
export const getEvent = (id) => request(`/admin/${id}`);
export const createEvent = (body) => request("/admin", { method: "POST", body });
export const updateEvent = (id, body) =>
  request(`/admin/${id}`, { method: "PATCH", body });
export const deleteEvent = (id) => request(`/admin/${id}`, { method: "DELETE" });
export const listRegistrations = (id, status) =>
  request(`/admin/${id}/registrations${status ? `?status=${status}` : ""}`);
export const approveRegistration = (id, regId) =>
  request(`/admin/${id}/registrations/${regId}/approve`, { method: "POST" });
export const rejectRegistration = (id, regId) =>
  request(`/admin/${id}/registrations/${regId}/reject`, { method: "POST" });
export const setVolunteers = (id, rollNumbers) =>
  request(`/admin/${id}/volunteers`, { method: "PUT", body: { rollNumbers } });
// Omit `code` to generate a random one.
export const setVolunteerCode = (id, code) =>
  request(`/admin/${id}/volunteer-code`, { method: "PUT", body: { code } });
