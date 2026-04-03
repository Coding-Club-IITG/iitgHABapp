const fs = require("fs");
const path = require("path");

// Common config files - same directory
const mainConfigPath = path.join(__dirname, "./config/appVersion.json");
const hqConfigPath = path.join(__dirname, "./config/hqAppVersion.json");
const rcConfigPath = path.join(__dirname, "./config/rcAppVersion.json");

/**
 * Read main HABit app version config
 */
const getVersionConfig = () => {
  try {
    const data = fs.readFileSync(mainConfigPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading version config:", error);
    return {
      android: {
        minVersionv1: "1.0.0",
        minVersionv2: "1.0.0",
        storeUrl: "",
        updateMessage: "A new version is available. Please update to continue.",
      },
      ios: {
        minVersionv1: "1.0.0",
        minVersionv2: "1.0.0",
        storeUrl: "",
        updateMessage: "A new version is available. Please update to continue.",
      },
    };
  }
};

/**
 * Save main HABit app version config
 */
const saveVersionConfig = (config) => {
  try {
    fs.mkdirSync(path.dirname(mainConfigPath), { recursive: true });
    fs.writeFileSync(mainConfigPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving version config:", error);
    return false;
  }
};

/**
 * Read HABit HQ (manager app) version config
 */
const getHqVersionConfig = () => {
  try {
    const data = fs.readFileSync(hqConfigPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading HQ version config:", error);
    // Default skeleton: v1 only, force update when below minVersionv1 (Android only for HQ)
    return {
      android: {
        minVersionv1: "1.0.0",
        storeUrl: "",
        updateMessage: "A new version is available. Please update to continue.",
      },
    };
  }
};

/**
 * Save HABit HQ (manager app) version config
 */
const saveHqVersionConfig = (config) => {
  try {
    fs.mkdirSync(path.dirname(hqConfigPath), { recursive: true });
    fs.writeFileSync(hqConfigPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving HQ version config:", error);
    return false;
  }
};

/**
 * Read HABit RC (room-cleaning manager app) version config
 */
const getRcVersionConfig = () => {
  try {
    const data = fs.readFileSync(rcConfigPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading RC version config:", error);
    // Default skeleton: Android-only, v1 style, force update when below minVersionv1
    return {
      android: {
        minVersionv1: "1.0.0",
        storeUrl: "",
        updateMessage:
          "A new version of HABit RC is available. Please update to continue.",
      },
    };
  }
};

/**
 * Save HABit RC (room-cleaning manager app) version config
 */
const saveRcVersionConfig = (config) => {
  try {
    fs.mkdirSync(path.dirname(rcConfigPath), { recursive: true });
    fs.writeFileSync(rcConfigPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving RC version config:", error);
    return false;
  }
};

/**
 * Get version info for a specific platform (returns both v1 and v2)
 */
const getVersionInfo = (req, res) => {
  try {
    const { platform } = req.params;

    if (!["android", "ios"].includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid platform. Must be 'android' or 'ios'.",
      });
    }

    const config = getVersionConfig();
    const platformKey = platform.toLowerCase();
    const platformConfig = config[platformKey];

    return res.status(200).json({
      success: true,
      data: {
        platform: platformKey,
        v1: {
          minVersion: platformConfig.minVersionv1,
          storeUrl: platformConfig.storeUrl,
          updateMessage: platformConfig.updateMessage,
        },
        v2: {
          minVersion: platformConfig.minVersionv2,
          storeUrl: platformConfig.storeUrl,
          updateMessage: platformConfig.updateMessage,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching version info:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch version info",
      error: error.message,
    });
  }
};

/**
 * Update version info for a specific platform (Admin only)
 */
const updateVersionInfo = (req, res) => {
  try {
    const { platform } = req.params;
    const { minVersionv1, minVersionv2, storeUrl, updateMessage } = req.body;

    if (!["android", "ios"].includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid platform. Must be 'android' or 'ios'.",
      });
    }

    const config = getVersionConfig();
    const platformKey = platform.toLowerCase();

    if (minVersionv1) config[platformKey].minVersionv1 = minVersionv1;
    if (minVersionv2) config[platformKey].minVersionv2 = minVersionv2;
    if (storeUrl) config[platformKey].storeUrl = storeUrl;
    if (updateMessage) config[platformKey].updateMessage = updateMessage;

    if (saveVersionConfig(config)) {
      return res.status(200).json({
        success: true,
        message: "Version info updated successfully",
        data: config[platformKey],
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to save version config",
      });
    }
  } catch (error) {
    console.error("Error updating version info:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update version info",
      error: error.message,
    });
  }
};

/**
 * Get all version info
 */
const getAllVersionInfo = (req, res) => {
  try {
    const config = getVersionConfig();
    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Error fetching all version info:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch version info",
      error: error.message,
    });
  }
};

/**
 * Get HABit HQ version info (Android only)
 */
const getHqVersionInfo = (req, res) => {
  try {
    const { platform } = req.params;
    if (platform.toLowerCase() !== "android") {
      return res.status(400).json({
        success: false,
        message: "Invalid platform. HABit HQ supports only 'android'.",
      });
    }

    const config = getHqVersionConfig();
    const platformConfig = config.android || {};

    return res.status(200).json({
      success: true,
      data: {
        platform: "android",
        minVersionv1: platformConfig.minVersionv1,
        storeUrl: platformConfig.storeUrl,
        updateMessage: platformConfig.updateMessage,
        // If app version < minVersionv1, client must force update (no optional skip)
        forceUpdate: true,
        minHQversion: platformConfig.minVersionv1,
      },
    });
  } catch (error) {
    console.error("Error fetching HQ version info:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch HABit HQ version info",
      error: error.message,
    });
  }
};

/**
 * Update HABit HQ version info (Android only, admin)
 */
const updateHqVersionInfo = (req, res) => {
  try {
    const { platform } = req.params;
    if (platform.toLowerCase() !== "android") {
      return res.status(400).json({
        success: false,
        message: "Invalid platform. HABit HQ supports only 'android'.",
      });
    }

    const { minVersionv1, storeUrl, updateMessage } = req.body;

    const config = getHqVersionConfig();
    if (!config.android) {
      config.android = {};
    }

    if (minVersionv1) config.android.minVersionv1 = minVersionv1;
    if (storeUrl) config.android.storeUrl = storeUrl;
    if (updateMessage) config.android.updateMessage = updateMessage;

    if (saveHqVersionConfig(config)) {
      return res.status(200).json({
        success: true,
        message: "HABit HQ version info updated successfully",
        data: config.android,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to save HABit HQ version config",
      });
    }
  } catch (error) {
    console.error("Error updating HQ version info:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update HABit HQ version info",
      error: error.message,
    });
  }
};

/**
 * Get all HABit HQ version info
 */
const getAllHqVersionInfo = (req, res) => {
  try {
    const config = getHqVersionConfig();
    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Error fetching all HQ version info:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch HABit HQ version info",
      error: error.message,
    });
  }
};

/**
 * Get HABit RC version info (Android only)
 */
const getRcVersionInfo = (req, res) => {
  try {
    const { platform } = req.params;
    if (platform.toLowerCase() !== "android") {
      return res.status(400).json({
        success: false,
        message: "Invalid platform. HABit RC supports only 'android'.",
      });
    }

    const config = getRcVersionConfig();
    const platformConfig = config.android || {};

    return res.status(200).json({
      success: true,
      data: {
        platform: "android",
        minVersionv1: platformConfig.minVersionv1,
        storeUrl: platformConfig.storeUrl,
        updateMessage: platformConfig.updateMessage,
        // If app version < minVersionv1, client must force update (no optional skip)
        forceUpdate: true,
        minRCversion: platformConfig.minVersionv1,
      },
    });
  } catch (error) {
    console.error("Error fetching RC version info:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch HABit RC version info",
      error: error.message,
    });
  }
};

/**
 * Update HABit RC version info (Android only, admin)
 */
const updateRcVersionInfo = (req, res) => {
  try {
    const { platform } = req.params;
    if (platform.toLowerCase() !== "android") {
      return res.status(400).json({
        success: false,
        message: "Invalid platform. HABit RC supports only 'android'.",
      });
    }

    const { minVersionv1, storeUrl, updateMessage } = req.body;

    const config = getRcVersionConfig();
    if (!config.android) {
      config.android = {};
    }

    if (minVersionv1) config.android.minVersionv1 = minVersionv1;
    if (storeUrl) config.android.storeUrl = storeUrl;
    if (updateMessage) config.android.updateMessage = updateMessage;

    if (saveRcVersionConfig(config)) {
      return res.status(200).json({
        success: true,
        message: "HABit RC version info updated successfully",
        data: config.android,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to save HABit RC version config",
      });
    }
  } catch (error) {
    console.error("Error updating RC version info:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update HABit RC version info",
      error: error.message,
    });
  }
};

/**
 * Get all HABit RC version info
 */
const getAllRcVersionInfo = (req, res) => {
  try {
    const config = getRcVersionConfig();
    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Error fetching all RC version info:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch HABit RC version info",
      error: error.message,
    });
  }
};

module.exports = {
  getVersionInfo,
  updateVersionInfo,
  getAllVersionInfo,
  getHqVersionInfo,
  updateHqVersionInfo,
  getAllHqVersionInfo,
  getRcVersionInfo,
  updateRcVersionInfo,
  getAllRcVersionInfo,
};
