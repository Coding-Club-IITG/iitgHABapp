import { GalaDinner } from "./galaDinnerModel.js";
import { GalaDinnerMenu } from "./galaDinnerMenuModel.js";
import { getIstStartOfToday } from "../../utils/date.js";

/**
 * Next upcoming gala for app bootstrap. When subscribedHostelId is set, returns
 * null if that hostel has no menus for the upcoming gala (not participating).
 */
export async function getUpcomingGalaData(subscribedHostelId) {
  const startOfToday = getIstStartOfToday();

  const upcomingGalas = await GalaDinner.find({
    date: { $gte: startOfToday },
  })
    .sort({ date: 1 })
    .limit(30)
    .lean();

  if (!upcomingGalas.length) return null;

  if (!subscribedHostelId) return upcomingGalas[0];

  for (const gala of upcomingGalas) {
    const participates = await GalaDinnerMenu.exists({
      galaDinnerId: gala._id,
      hostelId: subscribedHostelId,
    });
    if (participates) return gala;
  }

  return null;
}

