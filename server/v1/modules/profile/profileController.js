import axios from "axios";
import { User } from "../user/userModel.js";
import onedrive from "../../config/onedrive.js";
import { ProfileSettings } from "./profileSettingsModel.js";

import {
  requireDelegatedToken,
  extFromMime,
  getMe,
  getMyDrive,
  getItemById,
  findChildByName,
  deleteItemById,
  uploadToParentByName,
  createOrganizationViewLink,
} from "../../utils/onedriveController.js";

const PROFILE_FOLDER_ID = onedrive.profilePicsFolderId;

export async function setProfilePicture(req, res) {
  let debugContext = {
    apiVersion: "v1",
    method: req.method,
    url: req.originalUrl,
    hasFile: !!req.file,
    mimetype: req.file?.mimetype,
    size: req.file?.size,
  };

  try {
    console.log("[Profile][v1] setProfilePicture start", debugContext);

    // Resolve user + roll (supports both authenticated and unauthenticated calls)
    let user = req.user;
    let roll = null;
    if (user) {
      roll = user.rollNumber || user.roll || String(user._id);
    } else {
      roll =
        req.body?.rollNumber ||
        req.body?.roll ||
        req.query?.rollNumber ||
        req.query?.roll;
      if (!roll) {
        return res.status(400).json({
          message:
            "Missing rollNumber. Provide JWT auth or include 'rollNumber' field in form/query.",
        });
      }
      user = await User.findOne({ $or: [{ rollNumber: roll }, { roll }] });
      if (!user) {
        return res
          .status(404)
          .json({ message: `User not found for roll '${roll}'` });
      }
    }

    debugContext = {
      ...debugContext,
      roll,
      userId: user?._id?.toString(),
      isSetupDone: user?.isSetupDone,
    };

    // Feature flag: allow if (user.isSetupDone == false) OR (global toggle is enabled)
    const settings = await ProfileSettings.findOne();
    const allowPhotoChange = Boolean(settings?.allowProfilePhotoChange);
    if (user.isSetupDone === true && !allowPhotoChange) {
      return res.status(403).json({
        message:
          "Changing profile photo is not allowed now. Please contact the HAB Admin.",
      });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });
    if (!PROFILE_FOLDER_ID) {
      return res
        .status(400)
        .json({ message: "ONEDRIVE_PROFILE_PICS_FOLDER_ID is not configured" });
    }

    const ext = extFromMime(file.mimetype);
    const targetName = `${roll}${ext}`;
    debugContext = { ...debugContext, targetName };

    // Delegated token required to use /me/drive
    const token = await requireDelegatedToken();

    // Sanity checks: who am I? which drive? does folder exist?
    let drive;
    try {
      await getMe(token);
    } catch (e) {}

    try {
      drive = await getMyDrive(token);
    } catch (e) {}

    try {
      const parentItem = await getItemById(token, PROFILE_FOLDER_ID);
      if (
        drive?.id &&
        parentItem?.parentReference?.driveId &&
        drive.id !== parentItem.parentReference.driveId
      ) {
        return res.status(400).json({
          message:
            "Configured folder belongs to a different drive than the token user's drive.",
        });
      }
    } catch (e) {
      return res.status(400).json({
        message:
          "Configured ONEDRIVE_PROFILE_PICS_FOLDER_ID not found or not accessible for this account.",
        hint: "Fetch it with GET /v1.0/me/drive/root:/HAB%20App/profile-pics and use the returned id.",
      });
    }

    // Delete existing file(s) with the same roll number to avoid duplicates
    const existing = await findChildByName(
      token,
      PROFILE_FOLDER_ID,
      targetName,
    );
    for (const it of existing) {
      try {
        await deleteItemById(token, it.id);
      } catch (e) {}
    }

    // Upload new file
    const uploaded = await uploadToParentByName(
      token,
      PROFILE_FOLDER_ID,
      targetName,
      file.buffer,
      file.mimetype,
    );

    // Create org-scoped view link
    let publicUrl = null;
    try {
      publicUrl = await createOrganizationViewLink(token, uploaded.id);
    } catch (e) {}

    user.profilePictureItemId = uploaded.id;
    if (publicUrl) user.profilePictureUrl = publicUrl;
    // Do NOT mark isSetupDone here; it will be set on explicit save action
    await user.save();

    console.log("[Profile][v1] setProfilePicture success", {
      ...debugContext,
      itemId: uploaded.id,
      hasPublicUrl: !!publicUrl,
    });

    return res.status(200).json({
      message: "Profile picture updated",
      itemId: uploaded.id,
      url: publicUrl,
      name: targetName,
    });
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message || err.message;

    console.error("[Profile][v1] setProfilePicture error", {
      ...debugContext,
      status,
      message: msg,
      rawErrorMessage: err.message,
      stack: err.stack,
      graphError: err.response?.data,
    });

    return res
      .status(status === 403 ? 403 : 500)
      .json({ message: "Failed to set profile picture", error: msg, status });
  }
}

// Internal helper: stream profile picture bytes to res

async function sendProfilePictureForUser(user, res) {
  try {
    if (!user.profilePictureItemId && !user.profilePictureUrl) {
      return res.status(404).json({ message: "No profile picture set" });
    }

    if (user.profilePictureUrl) {
      try {
        // Try to fetch the URL server-side and inspect the response even if non-2xx
        const resp = await axios.get(user.profilePictureUrl, {
          responseType: "arraybuffer",
          validateStatus: () => true,
        });

        if (resp.status >= 200 && resp.status < 300) {
          res.setHeader(
            "Content-Type",
            resp.headers["content-type"] || "application/octet-stream",
          );
          return res.send(Buffer.from(resp.data));
        }

        // Org-view URL expired or returned non-2xx - try the Graph item directly
        if (user.profilePictureItemId) {
          try {
            const token = await requireDelegatedToken();
            const contentUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${user.profilePictureItemId}/content`;
            const graphResp = await axios.get(contentUrl, {
              responseType: "arraybuffer",
              headers: { Authorization: `Bearer ${token}` },
              validateStatus: () => true,
            });
            if (graphResp.status >= 200 && graphResp.status < 300) {
              res.setHeader(
                "Content-Type",
                graphResp.headers["content-type"] || "application/octet-stream",
              );
              return res.send(Buffer.from(graphResp.data));
            }
          } catch (ge) {}
        }

        // Both failed - return stored URL as a last resort
        return res.status(200).json({ url: user.profilePictureUrl });
      } catch (e) {
        return res.status(200).json({ url: user.profilePictureUrl });
      }
    }

    // No URL stored - stream via delegated token
    const token = await requireDelegatedToken();
    const contentUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${user.profilePictureItemId}/content`;
    const resp = await axios.get(contentUrl, {
      responseType: "arraybuffer",
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
    });

    if (resp.status >= 200 && resp.status < 300) {
      res.setHeader(
        "Content-Type",
        resp.headers["content-type"] || "application/octet-stream",
      );
      return res.send(Buffer.from(resp.data));
    }

    return res.status(502).json({
      message: "Failed to fetch profile picture from Graph",
      status: resp.status,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch profile picture",
      error: err.message,
      status: err.response?.status,
    });
  }
}

// GET /api/profile/picture/get (current authenticated user)
export async function getProfilePicture(req, res) {
  return sendProfilePictureForUser(req.user, res);
}

// Mess-manager (HABit HQ): get profile picture for a mess user by userId
export async function getProfilePictureForManager(req, res) {
  try {
    const managerHostel = req.managerHostel;
    const { userId } = req.params;

    if (!managerHostel || !managerHostel._id) {
      return res.status(400).json({ message: "Manager hostel not found" });
    }
    if (!userId) {
      return res.status(400).json({ message: "Missing userId" });
    }

    const hostelId = managerHostel._id.toString();

    const user = await User.findById(userId)
      .select("profilePictureItemId profilePictureUrl curr_subscribed_mess")
      .populate("curr_subscribed_mess", "hostel_name");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      !user.curr_subscribed_mess ||
      user.curr_subscribed_mess._id.toString() !== hostelId
    ) {
      return res
        .status(403)
        .json({ message: "User does not belong to this mess" });
    }

    return sendProfilePictureForUser(user, res);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch profile picture",
      error: err.message,
      status: err.response?.status,
    });
  }
}

// Mark setup complete for current user
export async function markSetupComplete(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    user.isSetupDone = true;
    await user.save();
    return res
      .status(200)
      .json({ message: "Setup marked complete", isSetupDone: true });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to mark setup complete",
      error: String(e.message || e),
    });
  }
}
