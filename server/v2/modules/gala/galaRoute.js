const express = require("express");
const {
  authenticateJWT,
  authenticateHabJWT,
  authenticateUserOrAdminJWT,
  authenticateMessManagerJWT,
} = require("../../middleware/authenticateJWT.js");
const {
  requireMicrosoftAuth,
} = require("../../middleware/requireMicrosoftAuth.js");
const {
  scheduleGalaDinner,
  deleteGalaDinner,
  listGalaDinners,
  getGalaDinnerDetailForHostel,
  getUpcomingGalaDinner,
  getUpcomingGalaWithMenusForHostel,
  galaScan,
  getGalaScanStatus,
  createGalaMenuItem,
  getGalaMenuItems,
  updateGalaMenuItem,
  deleteGalaMenuItem,
  getManagerGalaSummary,
} = require("./galaController.js");

const galaRouter = express.Router();

// HAB only
galaRouter.post("/schedule", authenticateHabJWT, scheduleGalaDinner);
galaRouter.get("/list", authenticateHabJWT, listGalaDinners);

// Mess-manager (HABit HQ): summary for upcoming gala for manager's hostel
galaRouter.get(
  "/manager/summary",
  authenticateMessManagerJWT,
  getManagerGalaSummary,
);

// Upcoming (static paths before /:galaDinnerId so they match correctly)
galaRouter.get("/upcoming", getUpcomingGalaDinner);

// SMC: upcoming gala + 3 menus for their hostel (hostel from token)
galaRouter.get(
  "/upcoming-with-menus",
  authenticateUserOrAdminJWT,
  getUpcomingGalaWithMenusForHostel
);

// App: upcoming gala + 3 menus for a hostel (hostelId in path, user token)
galaRouter.get(
  "/upcoming-with-menus/:hostelId",
  authenticateJWT,
  getUpcomingGalaWithMenusForHostel
);

// App: scan Gala QR
galaRouter.post(
  "/scan",
  authenticateJWT,
  requireMicrosoftAuth,
  galaScan
);

// App: get scan status for current user
galaRouter.get("/scan-status", authenticateJWT, getGalaScanStatus);

// HAB: detail and delete (param routes last)
galaRouter.get(
  "/:galaDinnerId/detail",
  authenticateHabJWT,
  getGalaDinnerDetailForHostel
);
galaRouter.delete("/:galaDinnerId", authenticateHabJWT, deleteGalaDinner);

// SMC: Gala menu item CRUD
galaRouter.post(
  "/menu/item",
  authenticateUserOrAdminJWT,
  createGalaMenuItem
);
galaRouter.get(
  "/menu/:galaDinnerMenuId/items",
  authenticateUserOrAdminJWT,
  getGalaMenuItems
);
galaRouter.patch(
  "/menu/item",
  authenticateUserOrAdminJWT,
  updateGalaMenuItem
);
galaRouter.delete(
  "/menu/item",
  authenticateUserOrAdminJWT,
  deleteGalaMenuItem
);

module.exports = galaRouter;
