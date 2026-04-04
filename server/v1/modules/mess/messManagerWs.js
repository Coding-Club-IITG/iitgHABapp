const url = require("url");
const { WebSocketServer } = require("ws");
const { Hostel } = require("../hostel/hostelModel.js");

// In-memory set of connected manager clients
// Each entry: { ws, hostelId, messId, meal } where meal is "breakfast" | "lunch" | "dinner" | null
const managerClients = new Set();

function normalizeMeal(meal) {
  if (!meal) return null;
  const lower = String(meal).toLowerCase();
  if (lower.startsWith("break")) return "breakfast";
  if (lower.startsWith("lunch")) return "lunch";
  if (lower.startsWith("dinn")) return "dinner";
  return null;
}

function initMessManagerWs(server) {
  const wss = new WebSocketServer({
    server,
    path: "/api/mess/manager/scan-logs",
  });

  wss.on("connection", async (ws, req) => {
    try {
      const { query } = url.parse(req.url, true);
      const token = query.token;
      const mealParam = normalizeMeal(query.meal);

      if (!token) {
        ws.close(1008, "Missing token");
        return;
      }

      const hostel = await Hostel.findByJWT(token);
      if (!hostel) {
        ws.close(1008, "Invalid token");
        return;
      }

      const hostelId = hostel._id.toString();
      const messId = hostel.messId ? hostel.messId.toString() : null;

      const clientInfo = {
        ws,
        hostelId,
        messId,
        meal: mealParam, // null = all meals
      };

      managerClients.add(clientInfo);

      ws.on("close", () => {
        managerClients.delete(clientInfo);
      });

      ws.on("error", () => {
        managerClients.delete(clientInfo);
      });
    } catch (err) {
      console.error("Error in Mess manager WS connection:", err);
      try {
        ws.close(1011, "Internal server error");
      } catch (_) {}
    }
  });
}

/**
 * Broadcast a new scan event to all connected mess-manager clients.
 *
 * @param {Object} params
 * @param {string} params.hostelId - Hostel ObjectId string
 * @param {string|null} params.messId - Mess ObjectId string (optional)
 * @param {string} params.mealType - "Breakfast" | "Lunch" | "Dinner"
 * @param {Object} params.user - { _id, name, rollNumber }
 * @param {Date|string} params.time - JS Date or ISO/string
 */
function broadcastMessScanToManagers({ hostelId, messId, mealType, user, time }) {
  if (!hostelId || !mealType || !user) return;
  const normalizedMeal = normalizeMeal(mealType);
  const isoTime =
    time instanceof Date ? time.toISOString() : String(time || new Date());

  const payload = JSON.stringify({
    mealType,
    time: isoTime,
    user: {
      _id: user._id?.toString?.() || user._id || "",
      name: user.name || "",
      rollNumber: user.rollNumber || "",
    },
  });

  for (const client of managerClients) {
    if (client.hostelId !== hostelId) continue;
    if (client.messId && messId && client.messId !== String(messId)) continue;
    if (client.meal && client.meal !== normalizedMeal) continue;

    try {
      client.ws.send(payload);
    } catch (err) {
      console.error("Failed to send WS message to manager client:", err);
    }
  }
}

module.exports = {
  initMessManagerWs,
  broadcastMessScanToManagers,
};

