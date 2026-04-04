const express = require("express");
const appVersionRouter = express.Router();
const hqAppVersionRouter = express.Router();
const {
  getVersionInfo,
  updateVersionInfo,
  getAllVersionInfo,
  getHqVersionInfo,
  updateHqVersionInfo,
  getAllHqVersionInfo,
} = require("./appVersionController");

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

module.exports = {
  appVersionRouter,
  hqAppVersionRouter,
};
