export const FESTIVAL_MODE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const getFestivalCacheUntil = (now = new Date()) => {
  return new Date(now.getTime() + FESTIVAL_MODE_CACHE_TTL_MS);
};

/**
 * Clear all festival-visible content when mode is disabled.
 * This keeps the disabled state visually clean on app/website until new data is uploaded.
 */
export const wipeFestivalVisibleContent = (festivalMode, now = new Date()) => {
  if (!festivalMode) return;

  festivalMode.isEnabled = false;
  festivalMode.expiresAt = null;

  // Legacy image pointers
  festivalMode.imageWithAlerts = null;
  festivalMode.imageWithoutAlerts = null;

  // New list-based media/text fields
  festivalMode.imagesWithAlerts = [];
  festivalMode.imagesWithoutAlerts = [];
  festivalMode.textsWithAlerts = [];
  festivalMode.textsWithoutAlerts = [];

  // Visual theme + text color defaults
  festivalMode.themeColor = "#4C4EDB";
  festivalMode.greetingTextColor = "";
  festivalMode.notificationSubtitleColor = "";

  festivalMode.lastUpdatedAt = now;
  festivalMode.cacheUntil = getFestivalCacheUntil(now);
};
