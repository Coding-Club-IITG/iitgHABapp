const axios = require("axios");
const { User } = require("../user/userModel.js");
const onedrive = require("../../config/onedrive.js");
const {
  getDelegatedAccessToken,
} = require("../../utils/delegatedGraphAuth.js");
const { ProfileSettings } = require("./profileSettingsModel.js");

const TENANT_ID = onedrive.tenantId; // from onedrive config
const CLIENT_ID = onedrive.clientId; // from onedrive config
const CLIENT_SECRET = onedrive.clientSecret; // from onedrive config
const STORAGE_USER_UPN = onedrive.storageUserUPN; // optional discovery
const DRIVE_ID = onedrive.driveId; // from onedrive config
const PROFILE_FOLDER_ID = onedrive.profilePicsFolderId; // parent folder itemId from .env

// Helper: require delegated token (we're using /me/drive semantics like the reference code)
async function requireDelegatedToken() {
  const tok = await getDelegatedAccessToken();
  if (!tok) {
    throw new Error(
      "Delegated token not available. Login as storage user and seed access+refresh tokens via /api/_debug/graph/delegated-token."
    );
  }
  return tok;
}

// Debug helpers removed
async function graphGET(url, token, config = {}) {
  const { data } = await axios.get(url, {
    ...config,
    headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` },
  });
  return data;
}

async function graphPUT(url, token, body, headers = {}) {
  const { data } = await axios.put(url, body, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return data;
}

async function graphPOST(url, token, body, headers = {}) {
  const { data } = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
  return data;
}

function extFromMime(mime) {
  if (!mime) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  return ".jpg";
}

async function getMe(token) {
  return graphGET("https://graph.microsoft.com/v1.0/me", token);
}

async function getMyDrive(token) {
  return graphGET("https://graph.microsoft.com/v1.0/me/drive", token);
}

async function getItemById(token, itemId) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?$select=id,name,parentReference,webUrl`;
  return graphGET(url, token);
}

async function findChildByName(token, parentId, name) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children?$select=id,name`;
  const data = await graphGET(url, token);
  const all = data?.value || [];
  const matches = all.filter((x) => x.name === name);

  return matches; // array (could be empty)
}

async function deleteItemById(token, itemId) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;

  await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
}

async function uploadToParentByName(
  token,
  parentId,
  filename,
  buffer,
  mimeType
) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(
    filename
  )}:/content`;

  const data = await graphPUT(url, token, buffer, {
    "Content-Type": mimeType || "application/octet-stream",
  });

  return data; // driveItem
}

async function createOrganizationViewLink(token, itemId) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/createLink`;
  const data = await graphPOST(
    url,
    token,
    { type: "view", scope: "organization" },
    { "Content-Type": "application/json" }
  );

  return data?.link?.webUrl;
}

// POST /api/profile/picture/set
async function setProfilePicture(req, res) {
  try {
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

    // Delegated token required to use /me/drive
    const token = await requireDelegatedToken();

    // Sanity checks: who am I? which drive? does folder exist?
    let me, drive, parentItem;
    try {
      me = await getMe(token);
    } catch (e) {}

    try {
      drive = await getMyDrive(token);
    } catch (e) {}

    try {
      parentItem = await getItemById(token, PROFILE_FOLDER_ID);
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
      // Parent folder lookup failed
      return res.status(400).json({
        message:
          "Configured ONEDRIVE_PROFILE_PICS_FOLDER_ID not found or not accessible for this account.",
        hint: "Fetch it with GET /v1.0/me/drive/root:/HAB%20App/profile-pics and use the returned id.",
      });
    }

    // If a file with the same roll number exists under the parent folder, delete it
    const existing = await findChildByName(
      token,
      PROFILE_FOLDER_ID,
      targetName
    );
    if (existing.length > 0) {
      for (const it of existing) {
        try {
          await deleteItemById(token, it.id);
        } catch (e) {}
      }
    } else {
    }

    // Upload new content to the parent folder with file name = roll.ext
    const uploaded = await uploadToParentByName(
      token,
      PROFILE_FOLDER_ID,
      targetName,
      file.buffer,
      file.mimetype
    );

    // Create org-scoped view link (tenant must allow it)
    let publicUrl = null;
    try {
      publicUrl = await createOrganizationViewLink(token, uploaded.id);
    } catch (e) {}

    user.profilePictureItemId = uploaded.id;
    if (publicUrl) user.profilePictureUrl = publicUrl;
    // Do NOT mark isSetupDone here; it will be set on explicit save action
    await user.save();

    return res.status(200).json({
      message: "Profile picture updated",
      itemId: uploaded.id,
      url: publicUrl,
      name: targetName,
    });
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message || err.message;
    return res
      .status(status === 403 ? 403 : 500)
      .json({ message: "Failed to set profile picture", error: msg, status });
  }
}

// Internal helper: send profile picture bytes/URL for a given user document
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
            resp.headers["content-type"] || "application/octet-stream"
          );
          return res.send(Buffer.from(resp.data));
        }

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
                graphResp.headers["content-type"] || "application/octet-stream"
              );
              return res.send(Buffer.from(graphResp.data));
            }
          } catch (ge) {}
        }

        // If we get here, both stored URL and Graph fallback didn't return bytes — return URL JSON as last resort
        return res.status(200).json({ url: user.profilePictureUrl });
      } catch (e) {
        return res.status(200).json({ url: user.profilePictureUrl });
      }
    }

    // Stream via delegated token for /me/drive
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
        resp.headers["content-type"] || "application/octet-stream"
      );
      return res.send(Buffer.from(resp.data));
    }
    // Non-OK from Graph — return a helpful error
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
async function getProfilePicture(req, res) {
  const user = req.user;
  return sendProfilePictureForUser(user, res);
}

// Mess-manager (HABit HQ): get profile picture for a mess user by userId
async function getProfilePictureForManager(req, res) {
  try {
    const managerHostel = req.managerHostel;
    const { userId } = req.params;

    if (!managerHostel || !managerHostel._id) {
      return res
        .status(400)
        .json({ message: "Manager hostel not found" });
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
async function markSetupComplete(req, res) {
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

module.exports = {
  setProfilePicture,
  getProfilePicture,
  getProfilePictureForManager,
  markSetupComplete,
};
