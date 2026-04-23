import axios from "axios";
import { getDelegatedAccessToken } from "./delegatedGraphAuth.js";
import onedrive from "../config/onedrive.js";

// Low-level auth
export async function requireDelegatedToken() {
  const tok = await getDelegatedAccessToken();
  if (!tok) {
    throw new Error(
      "Delegated token not available. Login as storage user and seed access+refresh tokens via /api/_debug/graph/delegated-token.",
    );
  }
  return tok;
}

// Low-level Graph HTTP helpers

export async function graphGET(url, token, config = {}) {
  const { data } = await axios.get(url, {
    ...config,
    headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function graphPUT(url, token, body, headers = {}) {
  const { data } = await axios.put(url, body, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return data;
}

export async function graphPOST(url, token, body, headers = {}) {
  const { data } = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
  return data;
}

// Drive item helpers

export function extFromMime(mime) {
  if (!mime) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  return ".jpg";
}

export async function getMe(token) {
  return graphGET("https://graph.microsoft.com/v1.0/me", token);
}

export async function getMyDrive(token) {
  return graphGET("https://graph.microsoft.com/v1.0/me/drive", token);
}

export async function getItemById(token, itemId) {
  return graphGET(
    `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?$select=id,name,parentReference,webUrl`,
    token,
  );
}

export async function findChildByName(token, parentId, name) {
  const data = await graphGET(
    `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children?$select=id,name`,
    token,
  );
  return (data?.value || []).filter((x) => x.name === name);
}

export async function deleteItemById(token, itemId) {
  await axios.delete(
    `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function uploadToParentByName(
  token,
  parentId,
  filename,
  buffer,
  mimeType,
) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(filename)}:/content`;
  return graphPUT(url, token, buffer, {
    "Content-Type": mimeType || "application/octet-stream",
  });
}

export async function createOrganizationViewLink(token, itemId) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/createLink`;
  const data = await graphPOST(
    url,
    token,
    { type: "view", scope: "organization" },
    { "Content-Type": "application/json" },
  );
  return data?.link?.webUrl;
}

function driveItemGraphDownloadUrl(driveItem) {
  if (!driveItem || typeof driveItem !== "object") return "";
  return String(driveItem["@microsoft.graph.downloadUrl"] || "").trim();
}

async function fetchDriveItemDownloadUrl(token, itemId) {
  if (!itemId) return "";
  const data = await graphGET(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}`,
    token,
  );
  return driveItemGraphDownloadUrl(data);
}

// Shared filename helper

/** Generates a unique filename infix: `-{userId}-{timestamp}-{random}-` */
export function makeUniqueMiddleName(userId) {
  const uniqueSuffix = Math.round(Math.random() * 1e9);
  return `-${userId}-${Date.now()}-${uniqueSuffix}-`;
}

// Core upload primitive

/**
 * Upload a buffer to any OneDrive folder. Returns { url, filename }
 * Throws on failure - callers are responsible for error handling
 */
export async function uploadBufferToFolder(
  buffer,
  mimetype,
  targetName,
  folderId,
) {
  if (!folderId) throw new Error("OneDrive folder ID is not configured");

  const token = await requireDelegatedToken();
  const uploaded = await uploadToParentByName(
    token,
    folderId,
    targetName,
    buffer,
    mimetype,
  );

  let publicUrl = "";
  try {
    publicUrl = await createOrganizationViewLink(token, uploaded.id);
  } catch (e) {
    console.error(
      `[OneDrive] Link creation failed for "${targetName}":`,
      e.message,
    );
  }

  return { url: publicUrl || "", filename: targetName, itemId: uploaded.id };
}

// Folder-specific helpers

/**
 * Upload to the leave documents folder
 * Prefers @microsoft.graph.downloadUrl over the org-view link for mobile compatibility
 * Returns { url, filename }
 */
export async function uploadBufferToLeaveFolder(buffer, mimetype, targetName) {
  const LEAVE_FOLDER_ID = onedrive.leaveFolderId;
  if (!LEAVE_FOLDER_ID)
    throw new Error("ONEDRIVE_LEAVE_FOLDER_ID is not configured");

  console.log("[OneDrive][leave] upload start", {
    targetName,
    mimetype: mimetype || "",
    bytes: buffer?.length ?? 0,
  });

  const token = await requireDelegatedToken();
  const uploaded = await uploadToParentByName(
    token,
    LEAVE_FOLDER_ID,
    targetName,
    buffer,
    mimetype,
  );

  // Prefer the pre-authenticated Graph download URL (works without M365 sign-in)
  let graphDownloadUrl = driveItemGraphDownloadUrl(uploaded);
  if (!graphDownloadUrl && uploaded?.id) {
    try {
      graphDownloadUrl = await fetchDriveItemDownloadUrl(token, uploaded.id);
    } catch (e) {
      console.error(
        "[OneDrive] Could not fetch @microsoft.graph.downloadUrl for leave PDF:",
        e.message,
      );
    }
  }

  let orgViewUrl = "";
  try {
    orgViewUrl = await createOrganizationViewLink(token, uploaded.id);
  } catch (e) {
    console.error("[OneDrive] Link creation failed for leave PDF:", e.message);
  }

  if (!graphDownloadUrl && orgViewUrl) {
    console.warn(
      "[OneDrive] leave PDF: no @microsoft.graph.downloadUrl; returning org link (in-app download may 403).",
    );
  }

  console.log("[OneDrive][leave] upload ok", {
    targetName,
    hasGraphDownloadUrl: Boolean(graphDownloadUrl),
    hasOrgViewUrl: Boolean(orgViewUrl),
  });

  return {
    url: graphDownloadUrl || orgViewUrl || "",
    filename: targetName,
  };
}

/**
 * Upload a report buffer (.xlsx) to the reports folder
 * Returns the public URL string, or null on failure (non-throwing)
 */
export async function uploadReportToOnedrive(buffer, filename) {
  const REPORTS_FOLDER_ID = onedrive.reportsFolderId;
  if (!REPORTS_FOLDER_ID) {
    console.error(
      "[OneDrive] ONEDRIVE_REPORTS_FOLDER_ID is not configured; skipping upload",
    );
    return null;
  }
  try {
    console.log(`[OneDrive] Uploading report "${filename}"...`);
    const result = await uploadBufferToFolder(
      buffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename,
      REPORTS_FOLDER_ID,
    );
    return result.url;
  } catch (err) {
    console.error("[OneDrive] Report upload failed:", err);
    return null;
  }
}

// Download helper

/**
 * Resolve a OneDrive org-view share URL and stream the file bytes to `res`
 * @param {{ inline?: boolean; filename?: string }} [options] - inline=true uses Content-Disposition: inline; filename sets attachment name
 */
export async function downloadFromOnedrive(url, res, options = {}) {
  const { inline = false, filename: suggestedFilename } = options;
  try {
    if (!url)
      return res.status(404).json({ message: "No document URL attached" });

    const extensionMap = {
      "application/pdf": ".pdf",
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        ".docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        ".xlsx",
    };

    const base64Value = Buffer.from(url).toString("base64");
    const encodedUrl =
      "u!" +
      base64Value.replace(/=/g, "").replace(/\//g, "_").replace(/\+/g, "-");
    const graphUrl = `https://graph.microsoft.com/v1.0/shares/${encodedUrl}/driveItem/content`;

    console.log("[OneDrive] Fetching from Graph Shares API...");
    const accessToken = await requireDelegatedToken();

    const response = await axios.get(graphUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer",
    });

    const contentType = response.headers["content-type"] || "application/pdf";
    const ext = extensionMap[contentType] || ".bin";
    res.setHeader("Content-Type", contentType);
    const disposition = inline ? "inline" : "attachment";
    let fileName =
      suggestedFilename && String(suggestedFilename).trim()
        ? String(suggestedFilename).trim()
        : `document-${Date.now()}${ext}`;
    if (suggestedFilename && !/\.[a-z0-9]+$/i.test(fileName)) {
      fileName = `${fileName}${ext}`;
    }
    const safe = fileName.replace(/[\r\n"]/g, "").slice(0, 180);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${safe}"`,
    );
    return res.send(Buffer.from(response.data));
  } catch (err) {
    console.error("[OneDrive] Error fetching document:", err);
    return res.status(500).json({
      message: "Failed to fetch document",
      error: err.message,
      status: err.response?.status,
    });
  }
}
