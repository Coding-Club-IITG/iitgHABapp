import { User } from "../user/userModel.js";
import { Hostel } from "../hostel/hostelModel.js";
import { Mess } from "../mess/messModel.js";
import { Menu } from "../mess/menuModel.js";
import { MenuItem } from "../mess/menuItemModel.js";
import { MessClosure } from "../hostel/messClosureModel.js";
import Alert from "../alert/alertModel.js";
import { GalaDinner } from "../gala/galaDinnerModel.js";
import { RoomCleaningBooking } from "../room_cleaning/roomCleaningBookingModel.js";

import { sortMenuItemsByMenuOrder } from "../../utils/sortMenuItemsByMenuOrder.js";
import {
  populateCurrSubscribedMess,
  subscribedMessDisplayName,
} from "../../utils/subscribedMessDisplay.js";
import { getCurrentDate, getCurrentDay } from "../../utils/date.js";

const IST_OFFSET_MINUTES = 5.5 * 60;

const getISTNow = () => {
  const now = new Date();
  const utcMillis = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMillis = utcMillis + IST_OFFSET_MINUTES * 60000;
  return new Date(istMillis);
};

const startOfDayIST = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

const endOfDayIST = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
};

function isBookingWindowOpen(bookingDate, now = getISTNow()) {
  const d = startOfDayIST(bookingDate);
  const openDay = new Date(d);
  openDay.setDate(openDay.getDate() - 3);
  const openTime = new Date(
    openDay.getFullYear(),
    openDay.getMonth(),
    openDay.getDate(),
    9,
    0,
    0,
    0,
  );
  const closeDay = new Date(d);
  closeDay.setDate(closeDay.getDate() - 2);
  const closeTime = endOfDayIST(closeDay);
  return now >= openTime && now <= closeTime;
}

function roundToTwoDecimals(n) {
  if (n == null || n === "") return 0;
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.round(v * 100) / 100;
}

function toIdString(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return null;
}

async function getUserPayload(userId) {
  const u = await User.findById(userId)
    .populate("hostel", "hostel_name")
    .populate(populateCurrSubscribedMess)
    .lean();

  if (!u) return null;

  return {
    ...u,
    hostel_name: u.hostel?.hostel_name ?? null,
    curr_subscribed_mess_name: subscribedMessDisplayName(
      u.curr_subscribed_mess,
    ),
  };
}

async function getUserMessInfoData(subscribedHostelId) {
  if (!subscribedHostelId) return null;

  const messHostel = await Hostel.findById(subscribedHostelId)
    .select("messId")
    .lean();
  if (!messHostel?.messId) return null;

  const messInfo = await Mess.findById(messHostel.messId).lean();
  if (!messInfo) return null;

  return {
    ...messInfo,
    rating:
      messInfo.rating != null ? roundToTwoDecimals(messInfo.rating) : 0,
    ranking: messInfo.ranking != null ? Math.round(messInfo.ranking) : 0,
    feedbackPercentage:
      messInfo.feedbackPercentage != null
        ? roundToTwoDecimals(messInfo.feedbackPercentage)
        : 0,
  };
}

async function getAllMessInfoData() {
  return Mess.aggregate([
    {
      $lookup: {
        from: "hostels",
        localField: "hostelId",
        foreignField: "_id",
        as: "hostelInfo",
      },
    },
    {
      $lookup: {
        from: "users",
        let: { hId: "$hostelId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$curr_subscribed_mess", "$$hId"] } } },
          { $count: "count" },
        ],
        as: "subscribers",
      },
    },
    {
      $addFields: {
        hostelName: {
          $ifNull: [{ $arrayElemAt: ["$hostelInfo.hostel_name", 0] }, null],
        },
        user_count: {
          $ifNull: [{ $arrayElemAt: ["$subscribers.count", 0] }, 0],
        },
        rating: {
          $round: [{ $ifNull: ["$rating", 0] }, 2],
        },
        ranking: {
          $round: [{ $ifNull: ["$ranking", 0] }, 0],
        },
        feedbackPercentage: {
          $round: [{ $ifNull: ["$feedbackPercentage", 0] }, 2],
        },
      },
    },
    {
      $project: {
        hostelInfo: 0,
        subscribers: 0,
      },
    },
  ]);
}

async function getUpcomingGalaData() {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  return GalaDinner.findOne({
    date: { $gte: startOfToday },
  })
    .sort({ date: 1 })
    .lean();
}

async function getAlertsForUser(userPayload) {
  const now = Date.now();
  const hostelId = toIdString(userPayload.hostel);
  const subscribedHostelId = toIdString(userPayload.curr_subscribed_mess);

  const filters = [{ targetType: "global" }];
  if (hostelId) filters.push({ targetType: "hostel", targetIds: hostelId });
  if (subscribedHostelId) {
    filters.push({ targetType: "mess", targetIds: subscribedHostelId });
  }

  const alerts = await Alert.find({
    expiresAt: { $gt: new Date(now) },
    $or: filters,
  }).lean();

  return alerts
    .map((alert) => ({
      id: alert._id.toString(),
      title: alert.title,
      body: alert.body,
      hasCountdown: alert.hasCountdown ? "true" : "false",
      expiresAt: new Date(alert.expiresAt).getTime().toString(),
      targetType: alert.targetType,
    }))
    .sort((a, b) => Number(a.expiresAt) - Number(b.expiresAt));
}

async function getRoomCleaningBookingsForUser(userId) {
  const bookings = await RoomCleaningBooking.find({ userId })
    .sort({ bookingDate: -1, createdAt: -1 })
    .select("_id bookingDate slot status hostelId feedbackId reason")
    .lean();

  const today = startOfDayIST(getISTNow());

  return bookings.map((booking) => {
    const bookingDate = startOfDayIST(booking.bookingDate);
    const future = bookingDate > today;
    const cancellableStatus =
      booking.status === "Booked" || booking.status === "Buffered";
    const windowOpen = future && isBookingWindowOpen(booking.bookingDate);

    return {
      ...booking,
      canCancel: cancellableStatus && future && windowOpen,
    };
  });
}

async function getTodayMenuForUser({ userId, subscribedHostelId, day }) {
  if (!subscribedHostelId) {
    return {
      day,
      messId: null,
      isMessClosed: false,
      menus: [],
    };
  }

  const messHostel = await Hostel.findById(subscribedHostelId)
    .select("messId")
    .lean();
  const messId = toIdString(messHostel?.messId);

  if (!messId) {
    return {
      day,
      messId: null,
      isMessClosed: false,
      menus: [],
    };
  }

  const menus = await Menu.find({ messId, day }).sort({ startTime: 1 }).lean();

  const populatedMenus = await Promise.all(
    menus.map(async (menu) => {
      const menuItems = menu.items || [];
      const menuItemDetails = await MenuItem.find({
        _id: { $in: menuItems },
      }).lean();

      const sortedItems = sortMenuItemsByMenuOrder(menuItems, menuItemDetails);

      return {
        ...menu,
        items: sortedItems.map((item) => ({
          ...item,
          isLiked:
            item.likes &&
            item.likes.some((id) => id.toString() === userId.toString()),
          likesCount: item.likes ? item.likes.length : 0,
          likes: undefined,
        })),
      };
    }),
  );

  const currentDate = getCurrentDate();
  const todayDate = new Date(currentDate);
  const isClosed = await MessClosure.findOne({
    hostelId: subscribedHostelId,
    closureDate: todayDate,
  }).lean();

  return {
    day,
    messId,
    isMessClosed: !!isClosed,
    message: isClosed
      ? "The mess is closed today as per the monthly schedule."
      : null,
    menus: populatedMenus,
  };
}

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

    const subscribedHostelId = toIdString(userPayload.curr_subscribed_mess);
    const todayDay = getCurrentDay();

    const settled = {};
    const errors = {};

    const tasks = await Promise.allSettled([
      getUserMessInfoData(subscribedHostelId),
      Hostel.find().select("-managerPasswordHash").lean(),
      getAllMessInfoData(),
      getUpcomingGalaData(),
      getAlertsForUser(userPayload),
      getRoomCleaningBookingsForUser(req.user._id),
      getTodayMenuForUser({
        userId: req.user._id,
        subscribedHostelId,
        day: todayDay,
      }),
    ]);

    settled.userMessInfo = tasks[0];
    settled.hostels = tasks[1];
    settled.allMessInfo = tasks[2];
    settled.upcomingGala = tasks[3];
    settled.alerts = tasks[4];
    settled.roomCleaningBookings = tasks[5];
    settled.todayMenu = tasks[6];

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
          bookings: settleResult(
            settled,
            "roomCleaningBookings",
            [],
            errors,
          ),
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
