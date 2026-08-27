import { logger } from "../../logging/logger.js";
import axios from "axios";
import path from "path";
import multer from "multer";

import FestivalMode from "./festivalModeModel.js";
import AppError from "../../utils/appError.js";
import {
  getFestivalCacheUntil,
  wipeFestivalVisibleContent,
} from "./festivalModeStateUtils.js";
import {
  uploadFestivalImageToOneDrive,
  deleteFestivalImageFromOneDrive,
} from "./onedriveFestivalUpload.js";
import { getDelegatedAccessToken } from "../../utils/delegatedGraphAuth.js";


// Memory storage for multer - OneDrive handles the actual storage
export const upload = multer({ storage: multer.memoryStorage() });

const buildFestivalImageProxyUrl = (req, itemId) => {
  // Return relative URL with /api prefix that clients can resolve
  // Clients prepend only the host part (protocol+domain:port) to form the full URL
  return `/api/festival-mode/image/item/${itemId}`;
};

const getImageResponseFromData = (req, imageData) => {
  if (!imageData) return null;
  return {
    ...imageData,
    url: imageData.itemId ? buildFestivalImageProxyUrl(req, imageData.itemId) : imageData.url || null,
  };
};

const getImageListResponseFromData = (req, images) => {
  if (!Array.isArray(images)) return [];
  return images
    .filter(Boolean)
    .map((img) => getImageResponseFromData(req, img))
    .filter((img) => img && img.url);
};

const firstNonEmptyText = (texts, fallback = "Happy Diwali") => {
  if (!Array.isArray(texts)) return fallback;
  const found = texts.find((t) => typeof t === "string" && t.trim().length > 0);
  return found ? found : fallback;
};

const parseFestivalExpiry = (rawExpiresAt) => {
  if (rawExpiresAt === null || rawExpiresAt === undefined || rawExpiresAt === "") {
    return null;
  }

  const parsed = new Date(rawExpiresAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, "Invalid expiresAt value");
  }
  return parsed;
};

/**
 * GET /api/festival-mode/active-summary
 * Minimal payload for mobile cold-start / pre-home: compare festivalId + isEnabled to Hive cache.
 */
export const getFestivalActiveSummary = async (req, res, next) => {
  try {
    let festivalMode = await FestivalMode.findOne();

    if (!festivalMode) {
      festivalMode = await FestivalMode.create({
        isEnabled: false,
        cacheUntil: getFestivalCacheUntil(),
      });
    }

    if (festivalMode.expiresAt && new Date() > festivalMode.expiresAt) {
      wipeFestivalVisibleContent(festivalMode, new Date());
      await festivalMode.save();
    }

    res.status(200).json({
      festivalId: festivalMode._id != null ? String(festivalMode._id) : null,
      isEnabled: Boolean(festivalMode.isEnabled),
      lastUpdatedAt: festivalMode.lastUpdatedAt,
      cacheUntil: festivalMode.cacheUntil,
    });
  } catch (err) {
    logger.error("Error fetching festival active summary:", { error: err });
    next(new AppError(500, "Failed to fetch festival active summary"));
  }
};

/**
 * GET /api/festival-mode/status
 * Public endpoint - no authentication needed
 * Returns current festival mode config with image URLs
 */
export const getFestivalModeStatus = async (req, res, next) => {
  try {
    let festivalMode = await FestivalMode.findOne();

    // If no document exists, create a default disabled state
    if (!festivalMode) {
      festivalMode = await FestivalMode.create({
        isEnabled: false,
        cacheUntil: getFestivalCacheUntil(),
      });
    }

    // Check if it has expired
    if (festivalMode.expiresAt && new Date() > festivalMode.expiresAt) {
      wipeFestivalVisibleContent(festivalMode, new Date());
      await festivalMode.save();
    }

    if (!festivalMode.isEnabled) {
      return res.status(200).json({
        festivalId: festivalMode._id,
        isEnabled: false,
        imageWithAlerts: null,
        imageWithoutAlerts: null,
        overlayTextWithAlerts: "",
        overlayTextWithoutAlerts: "",
        themeColor: "#4C4EDB",
        greetingTextColor: "",
        notificationSubtitleColor: "",
        imagesWithAlerts: [],
        imagesWithoutAlerts: [],
        textsWithAlerts: [],
        textsWithoutAlerts: [],
        lastUpdatedAt: festivalMode.lastUpdatedAt,
        cacheUntil: festivalMode.cacheUntil,
      });
    }

    // Prefer new array-based config; fall back to legacy single-image fields.
    const withAlertsList = getImageListResponseFromData(req, festivalMode.imagesWithAlerts);
    const withoutAlertsList = getImageListResponseFromData(req, festivalMode.imagesWithoutAlerts);

    const legacyWithAlerts = getImageResponseFromData(req, festivalMode.imageWithAlerts);
    const legacyWithoutAlerts = getImageResponseFromData(req, festivalMode.imageWithoutAlerts);

    const primaryWithAlerts = withAlertsList[0] || legacyWithAlerts;
    const primaryWithoutAlerts = withoutAlertsList[0] || legacyWithoutAlerts;

    const textsWithAlerts =
      Array.isArray(festivalMode.textsWithAlerts) && festivalMode.textsWithAlerts.length > 0
        ? festivalMode.textsWithAlerts
        : festivalMode.imageWithAlerts?.overlayText
          ? [festivalMode.imageWithAlerts.overlayText]
          : [];
    const textsWithoutAlerts =
      Array.isArray(festivalMode.textsWithoutAlerts) && festivalMode.textsWithoutAlerts.length > 0
        ? festivalMode.textsWithoutAlerts
        : festivalMode.imageWithoutAlerts?.overlayText
          ? [festivalMode.imageWithoutAlerts.overlayText]
          : [];

    res.status(200).json({
      festivalId: festivalMode._id,
      isEnabled: festivalMode.isEnabled,
      // Legacy fields (keep for existing mobile builds)
      imageWithAlerts: primaryWithAlerts?.url || null,
      imageWithoutAlerts: primaryWithoutAlerts?.url || null,
      overlayTextWithAlerts: firstNonEmptyText(textsWithAlerts, "Happy Diwali"),
      overlayTextWithoutAlerts: firstNonEmptyText(textsWithoutAlerts, "Happy Diwali"),
      // New fields
      themeColor: festivalMode.themeColor || "#4C4EDB",
      greetingTextColor: festivalMode.greetingTextColor || "",
      notificationSubtitleColor: festivalMode.notificationSubtitleColor || "",
      imagesWithAlerts: withAlertsList.map((img) => img.url),
      imagesWithoutAlerts: withoutAlertsList.map((img) => img.url),
      textsWithAlerts,
      textsWithoutAlerts,
      lastUpdatedAt: festivalMode.lastUpdatedAt,
      cacheUntil: festivalMode.cacheUntil, // Tell mobile app when to refresh
    });
  } catch (err) {
    logger.error("Error fetching festival mode:", { error: err });
    next(new AppError(500, "Failed to fetch festival mode"));
  }
};

/**
 * POST /api/festival-mode/upload
 * Admin only - upload festival images to OneDrive
 * Body: FormData { imageType: "with_alerts" | "without_alerts", file }
 */
export const uploadFestivalImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError(400, "Image file is required"));
    }

    const { imageType } = req.body;
    if (!["with_alerts", "without_alerts"].includes(imageType)) {
      return next(new AppError(400, "Invalid imageType"));
    }

    // Validate file is an image
    if (!req.file.mimetype.startsWith("image/")) {
      return next(new AppError(400, "File must be an image"));
    }

    // Max 5MB for festival images
    if (req.file.size > 5 * 1024 * 1024) {
      return next(new AppError(400, "Image must be less than 5MB"));
    }

    let festivalMode = await FestivalMode.findOne();
    if (!festivalMode) {
      festivalMode = await FestivalMode.create({ isEnabled: false });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname);
    const fileName = `festival-${imageType}-${timestamp}${ext}`;

    // Upload to OneDrive
    let uploaded;
    try {
      logger.info("Festival image upload started");
      uploaded = await uploadFestivalImageToOneDrive(
        req.file.buffer,
        req.file.mimetype,
        fileName,
      );
      logger.info("Festival image upload completed");
    } catch (err) {
      logger.error("OneDrive upload error:", {
        message: err.message,
        status: err.response?.status,
        errorCode: err.response?.data?.error?.code,
        errorMessage: err.response?.data?.error?.message,
        fullError: JSON.stringify(err.response?.data || {}),
      });
      // Use 502 for OneDrive auth issues, 500 for other OneDrive errors
      const statusCode = err.message?.includes("delegated token") ? 502 : 500;
      return next(
        new AppError(
          statusCode,
          err.response?.data?.error?.message || err.message || "Failed to upload image to OneDrive",
        ),
      );
    }

    const { overlayText } = req.body;
    const imageRecord = {
      url: uploaded.url,
      itemId: uploaded.itemId,
      overlayText: overlayText || "Happy Diwali",
    };

    if (imageType === "with_alerts") {
      festivalMode.imageWithAlerts = imageRecord;
      festivalMode.imagesWithAlerts = Array.isArray(festivalMode.imagesWithAlerts)
        ? [imageRecord, ...festivalMode.imagesWithAlerts]
        : [imageRecord];
    } else {
      festivalMode.imageWithoutAlerts = imageRecord;
      festivalMode.imagesWithoutAlerts = Array.isArray(festivalMode.imagesWithoutAlerts)
        ? [imageRecord, ...festivalMode.imagesWithoutAlerts]
        : [imageRecord];
    }

    festivalMode.lastUpdatedBy = req.user ? req.user._id : null;
    festivalMode.lastUpdatedAt = new Date();
    festivalMode.cacheUntil = getFestivalCacheUntil();
    await festivalMode.save();

    const proxyUrl = buildFestivalImageProxyUrl(req, uploaded.itemId);
    return res.status(200).json({
      success: true,
      imageType,
      url: proxyUrl,
      itemId: uploaded.itemId,
      uploadedAt: festivalMode.lastUpdatedAt,
      message: "Image uploaded successfully",
    });
  } catch (err) {
    logger.error("Error in uploadFestivalImage:", { error: err });
    next(
      new AppError(500, err.message || "Failed to upload festival image")
    );
  }
};

/**
 * POST /api/festival-mode/toggle
 * Admin only - enable/disable festival mode
 * Body: { isEnabled: Boolean }
 */
export const toggleFestivalMode = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { isEnabled } = body;

    let festivalMode = await FestivalMode.findOne();
    if (!festivalMode) {
      festivalMode = await FestivalMode.create({ isEnabled: false });
    }

    festivalMode.isEnabled = Boolean(isEnabled);
    if (festivalMode.isEnabled) {
      if (Object.prototype.hasOwnProperty.call(body, "expiresAt")) {
        festivalMode.expiresAt = parseFestivalExpiry(body.expiresAt);
      }
      festivalMode.lastUpdatedAt = new Date();
      // Reset cache timer on any change
      festivalMode.cacheUntil = getFestivalCacheUntil();
    } else {
      wipeFestivalVisibleContent(festivalMode, new Date());
    }

    festivalMode.lastUpdatedBy = req.user ? req.user._id : null;

    await festivalMode.save();

    res.status(200).json({
      success: true,
      isEnabled: festivalMode.isEnabled,
      expiresAt: festivalMode.expiresAt,
      message: `Festival mode ${festivalMode.isEnabled ? "enabled" : "disabled"}`,
    });
  } catch (err) {
    logger.error("Error toggling festival mode:", { error: err });
    if (err instanceof AppError) {
      return next(err);
    }
    next(new AppError(500, "Failed to update festival mode"));
  }
};

/**
 * DELETE /api/festival-mode/image/:imageType
 * Admin only - delete a festival image
 */
export const deleteFestivalImage = async (req, res, next) => {
  try {
    const { imageType } = req.params;
    if (!["with_alerts", "without_alerts"].includes(imageType)) {
      return next(new AppError(400, "Invalid imageType"));
    }

    let festivalMode = await FestivalMode.findOne();
    if (!festivalMode) {
      return next(new AppError(404, "Festival mode not configured"));
    }

    let imageData = null;
    if (imageType === "with_alerts") {
      imageData = festivalMode.imageWithAlerts;
      festivalMode.imageWithAlerts = null;
      festivalMode.imagesWithAlerts = [];
    } else {
      imageData = festivalMode.imageWithoutAlerts;
      festivalMode.imageWithoutAlerts = null;
      festivalMode.imagesWithoutAlerts = [];
    }

    if (!imageData) {
      return res.status(200).json({
        success: true,
        message: "No image to delete",
      });
    }

    // Delete from OneDrive if itemId exists
    if (imageData.itemId) {
      try {
        await deleteFestivalImageFromOneDrive(imageData.itemId);
      } catch (oneDriveErr) {
        logger.warn("OneDrive deletion warning:", oneDriveErr.message);
        // Don't fail if the item was already removed externally
      }
    }

    festivalMode.lastUpdatedBy = req.user ? req.user._id : null;
    festivalMode.lastUpdatedAt = new Date();
    festivalMode.cacheUntil = getFestivalCacheUntil();

    await festivalMode.save();

    res.status(200).json({
      success: true,
      imageType,
      message: "Image deleted successfully",
    });
  } catch (err) {
    logger.error("Error deleting festival image:", { error: err });
    next(new AppError(500, "Failed to delete festival image"));
  }
};

/**
 * DELETE /api/festival-mode/image/item/:itemId
 * Admin only - delete a specific festival image by OneDrive itemId
 */
export const deleteFestivalImageByItemId = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    if (!itemId) return next(new AppError(400, "itemId is required"));

    const festivalMode = await FestivalMode.findOne();
    if (!festivalMode) return next(new AppError(404, "Festival mode not configured"));

    const inWithArrays = (festivalMode.imagesWithAlerts || []).some((img) => img?.itemId === itemId);
    const inWithoutArrays = (festivalMode.imagesWithoutAlerts || []).some((img) => img?.itemId === itemId);
    const inLegacyWith = festivalMode.imageWithAlerts?.itemId === itemId;
    const inLegacyWithout = festivalMode.imageWithoutAlerts?.itemId === itemId;
    const isKnownFestivalItem =
      inWithArrays || inWithoutArrays || inLegacyWith || inLegacyWithout;

    if (!isKnownFestivalItem) {
      return res.status(404).json({
        success: false,
        message: "No festival image references this itemId",
      });
    }

    const beforeWith = Array.isArray(festivalMode.imagesWithAlerts) ? festivalMode.imagesWithAlerts.length : 0;
    const beforeWithout = Array.isArray(festivalMode.imagesWithoutAlerts) ? festivalMode.imagesWithoutAlerts.length : 0;

    festivalMode.imagesWithAlerts = (festivalMode.imagesWithAlerts || []).filter((img) => img?.itemId !== itemId);
    festivalMode.imagesWithoutAlerts = (festivalMode.imagesWithoutAlerts || []).filter((img) => img?.itemId !== itemId);

    // If legacy pointer matches, clear it
    if (festivalMode.imageWithAlerts?.itemId === itemId) festivalMode.imageWithAlerts = null;
    if (festivalMode.imageWithoutAlerts?.itemId === itemId) festivalMode.imageWithoutAlerts = null;

    try {
      await deleteFestivalImageFromOneDrive(itemId);
    } catch (oneDriveErr) {
      logger.warn("OneDrive deletion warning:", oneDriveErr.message);
    }

    festivalMode.lastUpdatedBy = req.user ? req.user._id : null;
    festivalMode.lastUpdatedAt = new Date();
    festivalMode.cacheUntil = getFestivalCacheUntil();
    await festivalMode.save();

    const removed = (beforeWith - (festivalMode.imagesWithAlerts || []).length) +
      (beforeWithout - (festivalMode.imagesWithoutAlerts || []).length);

    return res.status(200).json({
      success: true,
      itemId,
      removed,
      message: removed > 0 ? "Image deleted successfully" : "No matching image found (legacy may have been cleared)",
    });
  } catch (err) {
    logger.error("Error deleting festival image by itemId:", { error: err });
    next(new AppError(500, "Failed to delete festival image"));
  }
};

/**
 * GET /api/festival-mode/admin/config
 * Admin only - get detailed config for admin panel
 */
export const getFestivalImageContent = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    if (!itemId) {
      return next(new AppError(400, "itemId is required"));
    }

    const token = await getDelegatedAccessToken();
    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}/content`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "stream",
      validateStatus: (status) => status < 500,
    });

    if (response.status >= 400) {
      const message = response.data?.error?.message || "Failed to download festival image";
      return next(new AppError(response.status || 500, message));
    }

    res.setHeader("Content-Type", response.headers["content-type"] || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=300");
    response.data.pipe(res);
  } catch (err) {
    logger.error("Error proxying festival image content:", { error: err });
    next(new AppError(500, err.message || "Failed to fetch festival image"));
  }
};

export const getAdminFestivalConfig = async (req, res, next) => {
  try {
    let festivalMode = await FestivalMode.findOne().populate("lastUpdatedBy", "name email");

    if (!festivalMode) {
      festivalMode = await FestivalMode.create({ isEnabled: false });
    }

    res.status(200).json({
      festivalId: festivalMode._id,
      _id: festivalMode._id,
      isEnabled: festivalMode.isEnabled,
      imageWithAlerts: getImageResponseFromData(req, festivalMode.imageWithAlerts),
      imageWithoutAlerts: getImageResponseFromData(req, festivalMode.imageWithoutAlerts),
      imagesWithAlerts: getImageListResponseFromData(req, festivalMode.imagesWithAlerts),
      imagesWithoutAlerts: getImageListResponseFromData(req, festivalMode.imagesWithoutAlerts),
      textsWithAlerts: festivalMode.textsWithAlerts || [],
      textsWithoutAlerts: festivalMode.textsWithoutAlerts || [],
      themeColor: festivalMode.themeColor || "#4C4EDB",
      greetingTextColor: festivalMode.greetingTextColor || "",
      notificationSubtitleColor: festivalMode.notificationSubtitleColor || "",
      lastUpdatedBy: festivalMode.lastUpdatedBy,
      lastUpdatedAt: festivalMode.lastUpdatedAt,
      expiresAt: festivalMode.expiresAt,
      cacheUntil: festivalMode.cacheUntil,
    });
  } catch (err) {
    logger.error("Error fetching admin config:", { error: err });
    next(new AppError(500, "Failed to fetch festival config"));
  }
};

/**
 * POST /api/festival-mode/admin/config
 * Admin only - update festival mode admin-configurable fields (texts, themeColor)
 */
export const updateAdminFestivalConfig = async (req, res, next) => {
  try {
    const body = req.body || {};
    const {
      textsWithAlerts,
      textsWithoutAlerts,
      themeColor,
      greetingTextColor,
      notificationSubtitleColor,
    } = body;

    let festivalMode = await FestivalMode.findOne();
    if (!festivalMode) festivalMode = await FestivalMode.create({ isEnabled: false });

    if (Array.isArray(textsWithAlerts)) {
      festivalMode.textsWithAlerts = textsWithAlerts
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (Array.isArray(textsWithoutAlerts)) {
      festivalMode.textsWithoutAlerts = textsWithoutAlerts
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (typeof themeColor === "string" && themeColor.trim()) {
      festivalMode.themeColor = themeColor.trim();
    }
    if (typeof greetingTextColor === "string") {
      festivalMode.greetingTextColor = greetingTextColor.trim();
    }
    if (typeof notificationSubtitleColor === "string") {
      festivalMode.notificationSubtitleColor = notificationSubtitleColor.trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, "expiresAt")) {
      festivalMode.expiresAt = parseFestivalExpiry(body.expiresAt);
    }

    // Keep legacy overlay text in sync (best-effort)
    if (festivalMode.imageWithAlerts) {
      festivalMode.imageWithAlerts.overlayText =
        firstNonEmptyText(festivalMode.textsWithAlerts, festivalMode.imageWithAlerts.overlayText || "Happy Diwali");
      festivalMode.markModified("imageWithAlerts");
    }
    if (festivalMode.imageWithoutAlerts) {
      festivalMode.imageWithoutAlerts.overlayText =
        firstNonEmptyText(
          festivalMode.textsWithoutAlerts,
          festivalMode.imageWithoutAlerts.overlayText || "Happy Diwali",
        );
      festivalMode.markModified("imageWithoutAlerts");
    }

    festivalMode.lastUpdatedBy = req.user ? req.user._id : null;
    festivalMode.lastUpdatedAt = new Date();
    festivalMode.cacheUntil = getFestivalCacheUntil();
    try {
      await festivalMode.save();
    } catch (saveErr) {
      logger.error("FestivalMode save validation/error:", { error: saveErr });
      return next(
        new AppError(
          500,
          saveErr.message || "Failed to persist festival config",
        ),
      );
    }

    return res.status(200).json({
      success: true,
      message: "Festival config updated",
      themeColor: festivalMode.themeColor,
      greetingTextColor: festivalMode.greetingTextColor || "",
      notificationSubtitleColor: festivalMode.notificationSubtitleColor || "",
      textsWithAlerts: festivalMode.textsWithAlerts,
      textsWithoutAlerts: festivalMode.textsWithoutAlerts,
      expiresAt: festivalMode.expiresAt,
      lastUpdatedAt: festivalMode.lastUpdatedAt,
      cacheUntil: festivalMode.cacheUntil,
    });
  } catch (err) {
    logger.error("Error updating admin festival config:", { error: err });
    if (err instanceof AppError) {
      return next(err);
    }
    next(new AppError(500, "Failed to update festival config"));
  }
};

// named exports above
