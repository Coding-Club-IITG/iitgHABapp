import { MessSettings } from "./messSettingsModel.js";

export async function getSettings(req, res) {
  try {
    const s = await MessSettings.findOne();
    return res.status(200).json({
      messRebateEnabled: Boolean(s?.messRebateEnabled),
    });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to fetch mess settings",
      error: String(e.message || e),
    });
  }
}

async function setMessRebateEnabled(enabled) {
  let s = await MessSettings.findOne();
  if (!s) s = new MessSettings();
  s.messRebateEnabled = Boolean(enabled);
  await s.save();
  return s;
}

export async function enableMessRebate(req, res) {
  try {
    const s = await setMessRebateEnabled(true);
    return res.status(200).json({
      message: "Enabled",
      messRebateEnabled: Boolean(s.messRebateEnabled),
    });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to enable mess rebate",
      error: String(e.message || e),
    });
  }
}

export async function disableMessRebate(req, res) {
  try {
    const s = await setMessRebateEnabled(false);
    return res.status(200).json({
      message: "Disabled",
      messRebateEnabled: Boolean(s.messRebateEnabled),
    });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to disable mess rebate",
      error: String(e.message || e),
    });
  }
}

