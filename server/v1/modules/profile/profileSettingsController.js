import { logger } from "../../logging/logger.js";
import { ProfileSettings } from "./profileSettingsModel.js";
import { sendNotificationMessage } from "../notification/notificationController.js";

export async function getSettings(req, res) {
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

export async function enablePhotoChange(req, res) {
  try {
    let s = await ProfileSettings.findOne();
    if (!s) s = new ProfileSettings();

    if (s.allowProfilePhotoChange) {
      return res.status(200).json({
        message: "Already enabled",
        allowProfilePhotoChange: true,
      });
    }

    s.allowProfilePhotoChange = true;
    await s.save();
    sendNotificationMessage(
      "PROFILE UPDATE",
      "Profile Pic change is available",
      "All_Hostels",
      { redirectType: "profile", isAlert: "true" },
    ).catch((err) => logger.error("Profile update notification failed:", { error: err }));
    return res.status(200).json({
      message: "Enabled",
      allowProfilePhotoChange: true,
    });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to enable",
      error: String(e.message || e),
    });
  }
}

export async function disablePhotoChange(req, res) {
  try {
    const s = await ProfileSettings.findOne();
    if (!s) return res.status(404).json({ message: "Settings not found" });

    if (!s.allowProfilePhotoChange) {
      return res.status(200).json({
        message: "Already disabled",
        allowProfilePhotoChange: false,
      });
    }

    s.allowProfilePhotoChange = false;
    await s.save();
    sendNotificationMessage(
      "PROFILE UPDATE",
      "Profile Pic change is no longer available",
      "All_Hostels",
      { redirectType: "profile" },
    ).catch((err) => logger.error("Profile update notification failed:", { error: err }));
    return res
      .status(200)
      .json({ message: "Disabled", allowProfilePhotoChange: false });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Failed to disable", error: String(e.message || e) });
  }
}
