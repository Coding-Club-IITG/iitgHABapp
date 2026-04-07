const { ProfileSettings } = require("./profileSettingsModel.js");
const { User } = require("../user/userModel.js");
const {
  sendNotificationMessage,
} = require("../notification/notificationController.js");

async function getSettings(req, res) {
  try {
    const s = await ProfileSettings.findOne();
    return res
      .status(200)
      .json({ allowProfilePhotoChange: Boolean(s?.allowProfilePhotoChange) });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to fetch settings",
      error: String(e.message || e),
    });
  }
}

async function enablePhotoChange(req, res) {
  try {
    let s = await ProfileSettings.findOne();
    if (!s) s = new ProfileSettings();
    s.allowProfilePhotoChange = true;
    await s.save();
    sendNotificationMessage(
      "PROFILE UPDATE",
      "Profile Pic change is available",
      "All_Hostels",
      { redirectType: "profile", isAlert: "true" }
    ).catch((err) => console.error("Profile update notification failed:", err));
    // Reset setup status for all users who completed it earlier
    const result = await User.updateMany(
      { isSetupDone: true },
      { $set: { isSetupDone: false } }
    );

    return res.status(200).json({
      message: "Enabled",
      allowProfilePhotoChange: true,
      resetUsers: result?.modifiedCount ?? 0,
    });
  } catch (e) {
    return res.json({
      message: "Failed to enable",
      error: String(e.message || e),
    });
  }
}

async function disablePhotoChange(req, res) {
  try {
    const s = await ProfileSettings.findOne();
    if (!s) return res.status(404).json({ message: "Settings not found" });
    s.allowProfilePhotoChange = false;
    await s.save();
    sendNotificationMessage(
      "PROFILE UPDATE",
      "Profile Pic change is no longer available",
      "All_Hostels",
      { redirectType: "profile" }
    ).catch((err) => console.error("Profile update notification failed:", err));
    return res
      .status(200)
      .json({ message: "Disabled", allowProfilePhotoChange: false });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Failed to disable", error: String(e.message || e) });
  }
}

module.exports = { getSettings, enablePhotoChange, disablePhotoChange };
