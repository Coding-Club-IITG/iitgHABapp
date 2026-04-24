import express from "express";

import {
  authenticateJWT,
  authenticateHabJWT,
  authenticateUserOrAdminJWT,
  authenticateAdminJWT,
} from "../../middleware/authenticateJWT.js";
import { requireMicrosoftAuth } from "../../middleware/requireMicrosoftAuth.js";
import {
  getSettings as getMessSettings,
  enableMessRebate,
  disableMessRebate,
} from "./messSettingsController.js";
import {
  createMessShutdown,
  deleteMessShutdown,
  listMessShutdowns,
  listMyMessShutdowns,
} from "./messShutdownController.js";

import {
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
  updateMessWorker,
  generateMessBill,
  getMessBill,
  downloadMessBillFile,
  getAllMessBillsByMonth,
  getAvailableMessBillMonths,
} from "./messController.js";
import {
  getMessMenuByDayForSMC,
  modifyMenuItemSMC,
  reorderMenuItemsSMC,
  updateTimeSMC,
} from "./messAdminController.js";

const messRouter = express.Router();

const requireSMCOrAdmin = (req, res, next) => {
  if (req.hostel || req.user?.isSMC) {
    return next();
  }

  return res.status(403).json({ message: "Unauthorized" });
};

// Settings (feature toggles)
messRouter.get("/settings", getMessSettings);
messRouter.post("/settings/enable-rebate", authenticateHabJWT, enableMessRebate);
messRouter.post(
  "/settings/disable-rebate",
  authenticateHabJWT,
  disableMessRebate,
);

// HAB: Mess shutdowns (single day or range per hostel)
messRouter.get("/shutdowns", authenticateHabJWT, listMessShutdowns);
messRouter.post("/shutdowns", authenticateHabJWT, createMessShutdown);
messRouter.delete("/shutdowns/:id", authenticateHabJWT, deleteMessShutdown);

// Hostel: view shutdowns for current hostel (used in bill calculator)
messRouter.get("/shutdowns/my", authenticateAdminJWT, listMyMessShutdowns);

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
messRouter.put("/workers/:id", authenticateAdminJWT, updateMessWorker);
messRouter.delete("/workers/:id", authenticateAdminJWT, deleteMessWorker);
messRouter.post("/bill/generate", authenticateAdminJWT, generateMessBill);
messRouter.get("/bill/download", authenticateAdminJWT, downloadMessBillFile);
messRouter.get("/bill", authenticateAdminJWT, getMessBill);
messRouter.get("/bills/months", authenticateHabJWT, getAvailableMessBillMonths);
// HAB: download bill Excel without exposing OneDrive link
messRouter.get("/bills/download", authenticateHabJWT, downloadMessBillFile);
messRouter.get("/bills/all", authenticateHabJWT, getAllMessBillsByMonth);

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
messRouter.post(
  "/menu/items/reorder/smc/:messId",
  authenticateUserOrAdminJWT,
  reorderMenuItemsSMC,
);

// Bill routes moved above /:id to prevent route shadowing

export default messRouter;
