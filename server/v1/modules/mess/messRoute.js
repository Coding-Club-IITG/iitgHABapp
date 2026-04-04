const express = require("express");
const {
  authenticateJWT,
  authenticateHabJWT,
  authenticateUserOrAdminJWT,
  authenticateAdminJWT,
} = require("../../middleware/authenticateJWT.js");
const {
  requireMicrosoftAuth,
} = require("../../middleware/requireMicrosoftAuth.js");

const {
  createMess,
  createMessWithoutHostel,
  deleteMenu,
  createMenu,
  createMenuItem,
  deleteMenuItem,
  getUserMessInfo,
  getAllMessInfo,
  getMessInfo,
  getMessMenuByDay,
  getMessMenuByDayForAdminHAB,
  toggleLikeMenuItem,
  ScanMess,
  getUnassignedMess,
  assignMessToHostel,
  changeHostel,
  unassignMess,
  getMessWorkers,
  createMessWorker,
  deleteMessWorker,
  generateMessBill,
  getMessBill,
} = require("./messController");
const {
  getMessMenuByDayForSMC,
  modifyMenuItemSMC,
  updateTimeSMC,
} = require("./messAdminController.js");

const messRouter = express.Router();

const requireSMCOrAdmin = (req, res, next) => {
  if (req.hostel || req.user?.isSMC) {
    return next();
  }

  return res.status(403).json({ message: "Unauthorized" });
};

messRouter.post("/create", authenticateHabJWT, createMess);
messRouter.post(
  "/create-without-hostel",
  authenticateHabJWT,
  createMessWithoutHostel,
);
messRouter.post(
  "/menu/create",
  authenticateUserOrAdminJWT,
  requireSMCOrAdmin,
  createMenu,
);
messRouter.delete(
  "/menu/delete/:menuId",
  authenticateUserOrAdminJWT,
  requireSMCOrAdmin,
  deleteMenu,
);
messRouter.post(
  "/menu/item/create",
  authenticateUserOrAdminJWT,
  requireSMCOrAdmin,
  createMenuItem,
);
messRouter.delete(
  "/menu/item/delete",
  authenticateUserOrAdminJWT,
  requireSMCOrAdmin,
  deleteMenuItem,
);
messRouter.post("/get", authenticateJWT, getUserMessInfo);
messRouter.post("/all", getAllMessInfo);
// Move workers and bill routes before /:id to prevent route shadowing
messRouter.get("/workers", authenticateAdminJWT, getMessWorkers);
messRouter.post("/workers", authenticateAdminJWT, createMessWorker);
messRouter.delete("/workers/:id", authenticateAdminJWT, deleteMessWorker);
messRouter.post("/bill/generate", authenticateAdminJWT, generateMessBill);
messRouter.get("/bill", authenticateAdminJWT, getMessBill);

messRouter.get("/:id", authenticateHabJWT, getMessInfo);
messRouter.post("/menu/:messId", authenticateJWT, getMessMenuByDay);
messRouter.post(
  "/hab-menu/:messId",
  authenticateHabJWT,
  getMessMenuByDayForAdminHAB,
);
messRouter.post(
  "/menu/item/like/:menuItemId",
  authenticateJWT,
  requireMicrosoftAuth,
  toggleLikeMenuItem,
);
messRouter.post(
  "/scan/:messId",
  authenticateJWT,
  requireMicrosoftAuth,
  ScanMess,
);
messRouter.post("/reassign/:messId", authenticateHabJWT, assignMessToHostel);
messRouter.post("/change-hostel/:messId", authenticateHabJWT, changeHostel);
messRouter.post("/unassigned", authenticateHabJWT, getUnassignedMess);
messRouter.post("/unassign/:messId", authenticateHabJWT, unassignMess);

messRouter.post(
  "/menu/smc/:messId",
  authenticateUserOrAdminJWT,
  getMessMenuByDayForSMC,
);
messRouter.post(
  "/menu/modify/smc/:messId",
  authenticateUserOrAdminJWT,
  modifyMenuItemSMC,
);

messRouter.post(
  "/menu/time/update/smc/:messId",
  authenticateUserOrAdminJWT,
  updateTimeSMC,
);

// Bill routes moved above /:id to prevent route shadowing

module.exports = messRouter;
