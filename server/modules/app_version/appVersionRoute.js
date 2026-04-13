import express from "express";
export const appVersionRouter = express.Router();
export const hqAppVersionRouter = express.Router();
export const rcAppVersionRouter = express.Router();

import {
  getVersionInfo,
  updateVersionInfo,
  getAllVersionInfo,
  getHqVersionInfo,
  updateHqVersionInfo,
  getAllHqVersionInfo,
  getRcVersionInfo,
  updateRcVersionInfo,
  getAllRcVersionInfo,
} from "./appVersionController.js";

/**
 * HABit main app version routes
 * Base path (gateway): /api/app-version
 *
 * GET  /api/app-version/:platform
 * PUT  /api/app-version/:platform
 * GET  /api/app-version/
 */
appVersionRouter.get("/:platform", getVersionInfo);
appVersionRouter.put("/:platform", updateVersionInfo);
appVersionRouter.get("/", getAllVersionInfo);

/**
 * HABit HQ (manager app) version routes
 * Base path (gateway): /api/hq-app-version
 *
 * GET  /api/hq-app-version/android
 * PUT  /api/hq-app-version/android
 * GET  /api/hq-app-version/
 */
hqAppVersionRouter.get("/:platform", getHqVersionInfo);
hqAppVersionRouter.put("/:platform", updateHqVersionInfo);
hqAppVersionRouter.get("/", getAllHqVersionInfo);

/**
 * HABit RC (room-cleaning manager app) version routes
 * Base path (gateway): /api/rc-app-version
 *
 * GET  /api/rc-app-version/android
 * PUT  /api/rc-app-version/android
 * GET  /api/rc-app-version/
 */
rcAppVersionRouter.get("/:platform", getRcVersionInfo);
rcAppVersionRouter.put("/:platform", updateRcVersionInfo);
rcAppVersionRouter.get("/", getAllRcVersionInfo);
