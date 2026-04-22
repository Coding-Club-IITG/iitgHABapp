import { GalaDinner } from "./galaDinnerModel.js";
import { GalaDinnerMenu } from "./galaDinnerMenuModel.js";

/**
 * Next upcoming gala for app bootstrap. When subscribedHostelId is set, returns
 * null if that hostel has no menus for the upcoming gala (not participating).
 */
export async function getUpcomingGalaData(subscribedHostelId) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const upcoming = await GalaDinner.findOne({
    date: { $gte: startOfToday },
  })
    .sort({ date: 1 })
    .lean();

  if (!upcoming) {
    return null;
  }

  if (!subscribedHostelId) {
    return upcoming;
  }

  const participates = await GalaDinnerMenu.exists({
    galaDinnerId: upcoming._id,
    hostelId: subscribedHostelId,
  });

  return participates ? upcoming : null;
}

