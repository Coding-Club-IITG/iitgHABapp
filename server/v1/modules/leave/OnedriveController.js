const axios = require("axios");
const {
  getDelegatedAccessToken,
} = require("../../utils/delegatedGraphAuth.js");
require("dotenv").config();

const LEAVE_FOLDER_ID = process.env.ONEDRIVE_LEAVE_FOLDER_ID;

async function requireDelegatedToken() {
  const tok = await getDelegatedAccessToken();
  if (!tok) {
    throw new Error(
      "Delegated token not available. Login as storage user and seed access+refresh tokens via /api/_debug/graph/delegated-token.",
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
  mimeType,
) {
  // console.log(filename, buffer, mimeType);
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(
    filename,
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
    { "Content-Type": "application/json" },
  );

  return data?.link?.webUrl;
}

const processUpload = async (id, fileArray, prefix) => {
  if (!fileArray || fileArray.length === 0) return null;

  const file = fileArray[0]; // Grab the first (and only) file for this field
  const uniqueSuffix = Math.round(Math.random() * 1e9);

  const ext = extFromMime(file.mimetype);
  const timeStamp = Date.now();

  // Delegated token required to use /me/drive
  const token = await requireDelegatedToken();

  // Dynamic target name based on the prefix passed in
  const targetName = `${prefix}-${id}-${timeStamp}-${uniqueSuffix}-${file.originalname}`;

  // Upload to OneDrive
  const uploaded = await uploadToParentByName(
    token,
    LEAVE_FOLDER_ID,
    targetName,
    file.buffer,
    file.mimetype,
  );

  // Create public link
  let publicUrl = null;
  try {
    publicUrl = await createOrganizationViewLink(token, uploaded.id);
  } catch (e) {
    console.error(`Link creation failed for ${prefix}:`, e.message);
  }

  return {
    url: publicUrl || "",
    filename: file.originalname,
  };
};

const uploadFilesToOnedrive = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      req.uploadedDocuments = {};
      return next();
    }

    if (!LEAVE_FOLDER_ID) {
      return res
        .status(400)
        .json({ message: "ONEDRIVE_LEAVE_FOLDER_ID is not configured" });
    }

    req.uploadedDocuments = {};
    console.log(`Starting upload to onedrive for user: ${req.user?.name}`);

    req.uploadedDocuments.proofDocument = await processUpload(
      req.user._id,
      req.files["proofDocument"],
      "proofdocument",
    );
    req.uploadedDocuments.leaveDocument = await processUpload(
      req.user._id,
      req.files["leaveDocument"],
      "leavedocument",
    );

    console.log("OneDrive uploads successful", req.uploadedDocuments);
    next();
  } catch (err) {
    console.error("OneDrive upload failed:", err);
    const status = err.response?.status || 500;
    const msg = err.response?.data?.error?.message || err.message;
    return res.status(status === 403 ? 403 : 500).json({
      message: "Failed to upload verification documents",
      error: msg,
      status,
    });
  }
};

async function uploadSingleToOnedrive(req, res, next) {
  try {
    //Check already present in applyForLeave. So not required here
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
    const uniqueSuffix = Math.round(Math.random() * 1e9);

    const timeStamp = Date.now();
    // Dynamic target name based on the prefix passed in
    const targetName = `leavedocument-${req.user._id}-${timeStamp}-${uniqueSuffix}-${file.originalname}`;

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
    console.log(
      `Starting upload to onedrive to ${targetName} for user: ${req.user?.name}`,
    );
    // Upload new content to the parent folder with file name = roll.ext
    const uploaded = await uploadToParentByName(
      token,
      LEAVE_FOLDER_ID,
      targetName,
      file.buffer,
      file.mimetype,
    );

    //console.log("Uplaoding to onedrive successful.");
    //console.log("Creating organization view link");

    // Create org-scoped view link (tenant must allow it)
    let publicUrl = null;
    try {
      publicUrl = await createOrganizationViewLink(token, uploaded.id);
    } catch (e) {
      return res.status(401).json({
        message: "Error in creating public link. Please try again",
      });
    }

    req.file.leaveId = uploaded.id;
    if (publicUrl) req.file.leaveUrl = publicUrl;

    console.log("Uploading to onedrive successful");
    next();
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message || err.message;
    return res.status(status === 403 ? 403 : 500).json({
      message: "Failed to upload leave application",
      error: msg,
      status,
    });
  }
}

const sendDocument = async (req, res) => {
  const { proofDocumentUrl } = req.body;
  const documentUrl = proofDocumentUrl;
  try {
    if (!documentUrl) {
      return res.status(404).json({ message: "No document URL attached" });
    }

    if (documentUrl) {
      try {
        // Try to fetch the URL server-side and inspect the response even if non-2xx
        // const resp = await axios.get(proofDocumentUrl, {
        //   responseType: "arraybuffer",
        //   validateStatus: () => true,
        // });

        // if (resp.status >= 200 && resp.status < 300) {
        //   res.setHeader(
        //     "Content-Type",
        //     resp.headers["content-type"] || "application/octet-stream"
        //   );
        //   return res.send(Buffer.from(resp.data));
        // }

        const extensionMap = {
          "application/pdf": ".pdf",
          "image/jpeg": ".jpg",
          "image/png": ".png",
          "image/gif": ".gif",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            ".docx",
        };

        // Find the extension, default to .bin if unknown

        const base64Value = Buffer.from(documentUrl).toString("base64");
        const encodedUrl =
          "u!" +
          base64Value.replace(/=/g, "").replace(/\//g, "_").replace(/\+/g, "-");

        const graphUrl = `https://graph.microsoft.com/v1.0/shares/${encodedUrl}/driveItem/content`;

        console.log("Fetching from Graph Shares API...");

        const accessToken = await requireDelegatedToken();

        // 2. Fetch the actual binary content
        const response = await axios.get(graphUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          responseType: "arraybuffer",
        });

        const contentType =
          response.headers["content-type"] || "application/pdf";
        console.log("Content-type is", contentType);
        res.setHeader("Content-Type", contentType);
        const ext = extensionMap[contentType] || ".bin";
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="leave_document${ext}"`,
        );

        return res.send(Buffer.from(response.data));
      } catch (e) {
        console.error("Error in fetching document", e);
        return res.status(200).json({ url: proofDocumentUrl });
      }
    }
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch Proof Document",
      error: err.message,
      status: err.response?.status,
    });
  }
};

const uploadReportToOnedrive = async (buffer, filename) => {
  try {
    const folderId = process.env.ONEDRIVE_REPORTS_FOLDER_ID;
    if (!folderId) {
      console.warn(
        "ONEDRIVE_REPORTS_FOLDER_ID is not configured, skipping report upload.",
      );
      return null;
    }
    const token = await requireDelegatedToken();
    console.log(`Uploading report ${filename} to OneDrive...`);
    const uploaded = await uploadToParentByName(
      token,
      folderId,
      filename,
      buffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    let publicUrl = null;
    try {
      publicUrl = await createOrganizationViewLink(token, uploaded.id);
    } catch (e) {
      console.error("Link creation failed for report:", e.message);
    }
    return publicUrl || uploaded.webUrl;
  } catch (err) {
    console.error("OneDrive report upload failed:", err);
    return null;
  }
};

module.exports = {
  uploadSingleToOnedrive,
  sendDocument,
  uploadFilesToOnedrive,
  uploadReportToOnedrive,
};
