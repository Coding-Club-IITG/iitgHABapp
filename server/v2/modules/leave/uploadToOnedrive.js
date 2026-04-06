const axios = require('axios');
const { getDelegatedAccessToken } = require('../../utils/delegatedGraphAuth.js');
require('dotenv').config();

const LEAVE_FOLDER_ID = process.env.ONEDRIVE_LEAVE_FOLDER_ID;

async function requireDelegatedToken() {
  const tok = await getDelegatedAccessToken();
  if (!tok) {
    throw new Error(
      "Delegated token not available. Login as storage user and seed access+refresh tokens via /api/_debug/graph/delegated-token."
    );
  }
  return tok;
}

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

async function uploadToParentByName(
  token,
  parentId,
  filename,
  buffer,
  mimeType
) {
  // console.log(filename, buffer, mimeType);
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



async function uploadToOnedrive(req, res, next) {
  try {
    if(req.body.leaveType=="Medical" && !req.body.proofDocument){
      console.log("Not uploading proof document");
      return next();
    }
      const file = req.file;
      // console.log("Trying to upload proof document");
    //console.log("File received by Onedrive Uploader");
    if (!file) return res.status(400).json({ message: "No file uploaded" });
    if (!LEAVE_FOLDER_ID) {
      return res
        .status(400)
        .json({ message: "ONEDRIVE_LEAVE_FOLDER_ID is not configured" });
    }

    const ext = extFromMime(file.mimetype);
    const timeStamp = Date.now()
    const targetName = `leave-${req.user._id}-${timeStamp}-${file.originalname}`;

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
      parentItem = await getItemById(token, LEAVE_FOLDER_ID);
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
          "Configured ONEDRIVE_LEAVE_FOLDER_ID not found or not accessible for this account.",
        hint: "Fetch it with GET /v1.0/me/drive/root:/HAB%20App/rebate-requests and use the returned id.",
      });
    }
    console.log(`Starting upload to onedrive to ${targetName} for user: ${req.user?.name}`)
    // Upload new content to the parent folder with file name = roll.ext
    const uploaded = await uploadToParentByName(
      token,
      LEAVE_FOLDER_ID,
      targetName,
      file.buffer,
      file.mimetype
    );

    //console.log("Uplaoding to onedrive successful.");
    //console.log("Creating organization view link");

    // Create org-scoped view link (tenant must allow it)
    let publicUrl = null;
    try {
      publicUrl = await createOrganizationViewLink(token, uploaded.id);
    } catch (e) {
        return res.status(401).json({
            message: "Error in creating public link. Please try again"
        })
    }

    req.file.leaveId = uploaded.id;
    if (publicUrl) req.file.leaveUrl = publicUrl;

    console.log("Uploading to onedrive successful");
    next();
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message || err.message;
    return res
      .status(status === 403 ? 403 : 500)
      .json({ message: "Failed to upload leave application", error: msg, status });
  }
}

module.exports = {uploadToOnedrive};