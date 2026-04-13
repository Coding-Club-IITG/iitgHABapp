import axios from "axios";
import { getDelegatedAccessToken } from "../../utils/delegatedGraphAuth.js";

const FESTIVAL_FOLDER_ID = process.env.ONEDRIVE_FESTIVAL_FOLDER_ID;

async function graphRequest(method, url, token, body, headers = {}) {
  const config = {
    method,
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    data: body,
    validateStatus: (status) => status < 500,
  };

  const resp = await axios(config);
  if (resp.status >= 400) {
    const error = new Error(resp.data?.error?.message || resp.statusText || "Graph request failed");
    error.response = resp;
    throw error;
  }
  return resp.data;
}

async function uploadToParentByName(token, parentId, filename, buffer, mimeType) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(
    filename,
  )}:/content`;

  return graphRequest("PUT", url, token, buffer, {
    "Content-Type": mimeType || "application/octet-stream",
  });
}

async function createOrganizationViewLink(token, itemId) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/createLink`;
  const data = await graphRequest(
    "POST",
    url,
    token,
    { type: "view", scope: "organization" },
    { "Content-Type": "application/json" },
  );
  return data?.link?.webUrl || null;
}

async function getItemById(token, itemId) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
  return graphRequest("GET", url, token);
}

async function deleteItemById(token, itemId) {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
  return graphRequest("DELETE", url, token);
}

export async function uploadFestivalImageToOneDrive(buffer, mimeType, fileName) {
  if (!FESTIVAL_FOLDER_ID) {
    throw new Error("ONEDRIVE_FESTIVAL_FOLDER_ID is not configured");
  }

  console.log(`[OneDrive Festival] Getting delegated token for ${fileName}`);
  const token = await getDelegatedAccessToken().catch(err => {
    const errorMsg = err.message || "";
    console.error(`[OneDrive Festival] Token fetch error: ${errorMsg}`);
    if (errorMsg.includes("No refresh_token")) {
      throw new Error(
        "OneDrive delegated token not configured. " +
        "As an admin, visit http://localhost:3000/api/_debug/graph/start to authorize festival image uploads. " +
        "Login with the storage account (codingclub@iitg.ac.in) and complete the OAuth flow."
      );
    }
    throw err;
  });

  console.log(`[OneDrive Festival] Token acquired, checking folder access for ${FESTIVAL_FOLDER_ID}`);
  try {
    await getItemById(token, FESTIVAL_FOLDER_ID);
    console.log(`[OneDrive Festival] Folder access verified`);
  } catch (err) {
    console.error(`[OneDrive Festival] Folder access error:`, {
      message: err.message,
      status: err.response?.status,
      code: err.response?.data?.error?.code,
    });
    const message =
      err.response?.data?.error?.message || err.message ||
      "Festival folder not found or inaccessible";
    throw new Error(message);
  }

  console.log(`[OneDrive Festival] Uploading file to OneDrive`);
  const uploaded = await uploadToParentByName(
    token,
    FESTIVAL_FOLDER_ID,
    fileName,
    buffer,
    mimeType,
  );

  let publicUrl = null;
  try {
    publicUrl = await createOrganizationViewLink(token, uploaded.id);
  } catch (err) {
    // fallback to the file webUrl if available
    publicUrl = uploaded.webUrl || null;
  }

  return {
    itemId: uploaded.id,
    fileName: uploaded.name,
    url: publicUrl || uploaded.webUrl || null,
  };
}

export async function deleteFestivalImageFromOneDrive(itemId) {
  if (!itemId) return;
  let token;
  try {
    token = await getDelegatedAccessToken();
  } catch (err) {
    const errorMsg = err.message || "";
    if (errorMsg.includes("No refresh_token")) {
      console.warn(
        "OneDrive delegated token not configured for deletion. " +
        "Visit http://localhost:3000/api/_debug/graph/start to authorize. " +
        "Skipping OneDrive deletion (file remains but database record is cleaned)."
      );
      return; // Gracefully skip deletion if token not available
    }
    throw err;
  }
  await deleteItemById(token, itemId);
}

// named exports above
