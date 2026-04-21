import { GalaDinner } from "./galaDinnerModel.js";

export async function getUpcomingGalaData() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return GalaDinner.findOne({
    date: { $gte: startOfToday },
  })
    .sort({ date: 1 })
    .lean();
}

