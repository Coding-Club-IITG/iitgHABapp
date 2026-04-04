const url = require("url");
const { WebSocketServer } = require("ws");
const { Hostel } = require("../hostel/hostelModel.js");

// Connected gala manager clients per hostel
// Each entry: { ws, hostelId }
const galaManagerClients = new Set();

function initGalaManagerWs(server) {
  const wss = new WebSocketServer({
    server,
    path: "/api/gala/manager/scan-logs",
  });

  wss.on("connection", async (ws, req) => {
    try {
      const { query } = url.parse(req.url, true);
      const token = query.token;

      if (!token) {
        ws.close(1008, "Missing token");
        return;
      }

      const hostel = await Hostel.findByJWT(token);
      if (!hostel) {
        ws.close(1008, "Invalid token");
        return;
      }

      const clientInfo = {
        ws,
        hostelId: hostel._id.toString(),
      };

      galaManagerClients.add(clientInfo);

      ws.on("close", () => {
        galaManagerClients.delete(clientInfo);
      });

      ws.on("error", () => {
        galaManagerClients.delete(clientInfo);
      });
    } catch (err) {
      console.error("Error in Gala manager WS connection:", err);
      try {
        ws.close(1011, "Internal server error");
      } catch (_) {}
    }
  });
}

/**
 * Broadcast a Gala scan event to all connected manager clients for a hostel.
 *
 * @param {Object} params
 * @param {string} params.hostelId - Hostel ObjectId string
 * @param {string} params.mealType - "Starters" | "Main Course" | "Desserts"
 * @param {Object} params.user - {_id, name, rollNumber}
 * @param {string} params.time - time string (e.g. "HH:mm")
 * @param {boolean} params.alreadyScanned
 */
function broadcastGalaScanToManagers({
  hostelId,
  mealType,
  user,
  time,
  alreadyScanned,
}) {
  if (!hostelId || !mealType || !user) return;

  const payload = JSON.stringify({
    mealType,
    time,
    alreadyScanned: !!alreadyScanned,
    user: {
      _id: user._id?.toString?.() || user._id || "",
      name: user.name || "",
      rollNumber: user.rollNumber || "",
    },
  });

  for (const client of galaManagerClients) {
    if (client.hostelId !== hostelId) continue;
    try {
      client.ws.send(payload);
    } catch (err) {
      console.error("Failed to send WS Gala message to manager client:", err);
    }
  }
}

module.exports = {
  initGalaManagerWs,
  broadcastGalaScanToManagers,
};

