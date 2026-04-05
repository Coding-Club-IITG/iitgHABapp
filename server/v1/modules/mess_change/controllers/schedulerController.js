const { MessChangeSettings } = require("../messChangeSettingsModel.js");
const {
  sendNotificationMessage,
} = require("../../notification/notificationController.js");
const { processAllMessChangeRequests } = require("./processingController.js");

/**
 * Enable mess change automatically (for scheduler)
 */
const enableMessChangeAutomatic = async (closingTime = null) => {
  try {
    let settings = await MessChangeSettings.findOne();

    if (!settings) {
      settings = new MessChangeSettings({
        isEnabled: true,
        enabledAt: new Date(),
        currentWindowClosingTime: closingTime,
      });
    } else {
      settings.isEnabled = true;
      settings.enabledAt = new Date();
      settings.currentWindowClosingTime = closingTime;
      settings.disabledAt = null;
    }

    await settings.save();

    sendNotificationMessage(
      "MESS CHANGE",
      "Mess Change is Enabled",
      "All_Hostels",
      { redirectType: "mess_change", isAlert: "true" },
    ).catch((err) =>
      console.error("Mess change enabled notification failed:", err),
    );

    console.log("✅ Mess change enabled automatically");
    return { success: true, settings };
  } catch (error) {
    console.error("❌ Error enabling mess change automatically:", error);
    return { success: false, error };
  }
};

/**
 * Disable mess change automatically by invoking the full processing flow
 * This ensures pending requests are processed before the window is closed.
 */
const disableMessChangeAutomatic = async () => {
  try {
    // processAllMessChangeRequests is an express-style handler (req, res).
    // Provide a minimal fake `res` so it can return JSON without an HTTP response.
    const fakeRes = {
      status(code) {
        return {
          json(payload) {
            console.log(
              `[messchange] processAllMessChangeRequests result: ${code}`,
              payload && payload.message ? payload.message : payload,
            );
            return payload;
          },
        };
      },
    };

    await processAllMessChangeRequests(null, fakeRes);

    // Ensure settings are updated (processAllMessChangeRequests should have
    // already called updateLastProcessedTimestamp, but we double-check here).
    let settings = await MessChangeSettings.findOne();
    if (settings && settings.isEnabled) {
      settings.isEnabled = false;
      settings.disabledAt = new Date();
      await settings.save();
    }

    console.log("✅ Mess change disabled automatically (processed requests)");
    return { success: true, settings };
  } catch (error) {
    console.error("❌ Error disabling mess change automatically:", error);
    return { success: false, error };
  }
};

module.exports = {
  enableMessChangeAutomatic,
  disableMessChangeAutomatic,
};
