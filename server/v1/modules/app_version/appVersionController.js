const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../config/appVersion.json");

/**
 * Read version config from JSON file
 */
const getVersionConfig = () => {
  try {
    const data = fs.readFileSync(configPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading version config:", error);
    return {
      android: {
        minVersion: "1.0.0",
        latestVersion: "1.0.0",
        storeUrl: "",
        forceUpdate: true,
        updateMessage: "A new version is available. Please update to continue.",
      },
      ios: {
        minVersion: "1.0.0",
        latestVersion: "1.0.0",
        storeUrl: "",
        forceUpdate: true,
        updateMessage: "A new version is available. Please update to continue.",
      },
    };
  }
};

/**
 * Save version config to JSON file
 */
const saveVersionConfig = (config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving version config:", error);
    return false;
  }
};

/**
 * Get version info for a specific platform
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
    const versionInfo = config[platform.toLowerCase()];

    return res.status(200).json({
      success: true,
      data: {
        platform: platform.toLowerCase(),
        ...versionInfo,
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
    const { minVersion, latestVersion, storeUrl, forceUpdate, updateMessage } =
      req.body;

    if (!["android", "ios"].includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid platform. Must be 'android' or 'ios'.",
      });
    }

    const config = getVersionConfig();
    const platformKey = platform.toLowerCase();

    if (minVersion) config[platformKey].minVersion = minVersion;
    if (latestVersion) config[platformKey].latestVersion = latestVersion;
    if (storeUrl) config[platformKey].storeUrl = storeUrl;
    if (typeof forceUpdate === "boolean")
      config[platformKey].forceUpdate = forceUpdate;
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

module.exports = {
  getVersionInfo,
  updateVersionInfo,
  getAllVersionInfo,
};
