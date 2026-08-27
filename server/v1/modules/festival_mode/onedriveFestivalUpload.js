import { logger } from "../../logging/logger.js";
import { getDelegatedAccessToken } from "../../utils/delegatedGraphAuth.js";
import onedrive from "../../config/onedrive.js";
import {
  getItemById,
  uploadToParentByName,
  createOrganizationViewLink,
  deleteItemById,
} from "../../utils/onedriveController.js";

const FESTIVAL_FOLDER_ID = onedrive.festivalFolderId;

export async function uploadFestivalImageToOneDrive(
  buffer,
  mimeType,
  fileName,
) {
  if (!FESTIVAL_FOLDER_ID) {
    throw new Error("ONEDRIVE_FESTIVAL_FOLDER_ID is not configured");
  }

  logger.info("OneDrive delegated token requested");
  const token = await getDelegatedAccessToken().catch((err) => {
    const errorMsg = err.message || "";
    logger.error("OneDrive delegated token request failed", { error });
    if (errorMsg.includes("No refresh_token")) {
      throw new Error("OneDrive delegated token not configured");
    }
    throw err;
  });

  logger.info(
    `[OneDrive Festival] Token acquired, checking folder access for ${FESTIVAL_FOLDER_ID}`,
  );
  try {
    await getItemById(token, FESTIVAL_FOLDER_ID);
    logger.info(`[OneDrive Festival] Folder access verified`);
  } catch (err) {
    logger.error(`[OneDrive Festival] Folder access error:`, {
      message: err.message,
      status: err.response?.status,
      code: err.response?.data?.error?.code,
    });
    const message =
      err.response?.data?.error?.message ||
      err.message ||
      "Festival folder not found or inaccessible";
    throw new Error(message);
  }

  logger.info(`[OneDrive Festival] Uploading file to OneDrive`);
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
      logger.debug("OneDrive delegated deletion is disabled");
      return; // Gracefully skip deletion if token not available
    }
    throw err;
  }
  await deleteItemById(token, itemId);
}
