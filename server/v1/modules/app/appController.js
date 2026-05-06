import { Hostel } from "../hostel/hostelModel.js";
import { getCurrentDay } from "../../utils/date.js";

import { getUserPayload } from "../user/userPayloadService.js";
import {
  getUserMessInfoBySubscribedHostel,
  getAllMessInfo,
} from "../mess/services/messInfoService.js";
import { getTodayMenuForUser } from "../mess/services/menuService.js";
import { getActiveAlertsForUser } from "../notification/alertsService.js";
import { getRoomCleaningBookingsForUser } from "../room_cleaning/myBookingsService.js";
import { getUpcomingGalaData } from "../gala/upcomingGalaService.js";
import { buildSummerMessStatusForUser } from "../summer_mess/summerMessService.js";

function settleResult(results, name, fallbackValue, errors) {
  const result = results[name];
  if (!result) return fallbackValue;
  if (result.status === "fulfilled") return result.value;

  errors[name] = result.reason?.message || "Failed to fetch";
  return fallbackValue;
}

export const getAppBootstrap = async (req, res) => {
  try {
    const userPayload = await getUserPayload(req.user._id);
    if (!userPayload) {
      return res.status(404).json({ message: "User not found" });
    }

    const todayDay = getCurrentDay();
    const subscribedHostelId = userPayload.curr_subscribed_mess?._id
      ? userPayload.curr_subscribed_mess._id.toString()
      : userPayload.curr_subscribed_mess?.toString?.() ?? null;

    const settled = {};
    const errors = {};

    const tasks = await Promise.allSettled([
      getUserMessInfoBySubscribedHostel(subscribedHostelId),
      Hostel.find().select("-managerPasswordHash").lean(),
      getAllMessInfo({ useCache: true }),
      getUpcomingGalaData(subscribedHostelId),
      getActiveAlertsForUser(userPayload),
      getRoomCleaningBookingsForUser(req.user._id),
      getTodayMenuForUser({ userId: req.user._id, subscribedHostelId, day: todayDay }),
      buildSummerMessStatusForUser(req.user._id),
    ]);

    settled.userMessInfo = tasks[0];
    settled.hostels = tasks[1];
    settled.allMessInfo = tasks[2];
    settled.upcomingGala = tasks[3];
    settled.alerts = tasks[4];
    settled.roomCleaningBookings = tasks[5];
    settled.todayMenu = tasks[6];
    settled.summerMess = tasks[7];

    return res.status(200).json({
      success: true,
      data: {
        user: userPayload,
        userMessInfo: settleResult(settled, "userMessInfo", null, errors),
        hostels: settleResult(settled, "hostels", [], errors),
        allMessInfo: settleResult(settled, "allMessInfo", [], errors),
        upcomingGala: settleResult(settled, "upcomingGala", null, errors),
        alerts: settleResult(settled, "alerts", [], errors),
        roomCleaningBookings: {
          bookings: settleResult(settled, "roomCleaningBookings", [], errors),
        },
        todayMenu: settleResult(
          settled,
          "todayMenu",
          {
            day: todayDay,
            messId: null,
            isMessClosed: false,
            menus: [],
          },
          errors,
        ),
        summerMessStatus: settleResult(
          settled,
          "summerMess",
          {
            shouldShowCard: false,
            registration: { isOpen: false, startAt: null, endAt: null },
            summer: { isActive: false, startAt: null, endAt: null },
            canApply: false,
            availableHostels: [],
            application: null,
            boardingHostel: null,
            currentSubscription: null,
          },
          errors,
        ),
      },
      errors,
      meta: {
        day: todayDay,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("getAppBootstrap error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch app bootstrap data",
      error: error.message,
    });
  }
};
