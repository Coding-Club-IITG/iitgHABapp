import redisClient from "../../../utils/redisClient.js";

import { Hostel } from "../../hostel/hostelModel.js";
import { Mess } from "../messModel.js";
import { Menu } from "../menuModel.js";
import { MenuItem } from "../menuItemModel.js";
import { MessShutdown } from "../messShutdownModel.js";

import { getCurrentDate } from "../../../utils/date.js";
import { sortMenuItemsByMenuOrder } from "../../../utils/sortMenuItemsByMenuOrder.js";

function toIdString(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return null;
}

function withUserLikes(items, userId) {
  const userIdStr = userId?.toString();
  return items.map((item) => ({
    ...item,
    isLiked:
      !!userIdStr &&
      item.likes &&
      item.likes.some((id) => id.toString() === userIdStr),
    likesCount: item.likes ? item.likes.length : 0,
    likes: undefined,
  }));
}

function withAdminLikeCountsOnly(items) {
  return items.map((item) => ({
    ...item,
    likesCount: item.likes ? item.likes.length : 0,
    likes: undefined,
  }));
}

async function fetchMenusForMessDay({ messId, day }) {
  const menus = await Menu.find({ messId, day }).sort({ startTime: 1 }).lean();
  if (!menus || menus.length === 0) return [];

  return Promise.all(
    menus.map(async (menu) => {
      const menuItems = menu.items || [];
      const menuItemDetails = await MenuItem.find({
        _id: { $in: menuItems },
      }).lean();

      const sortedItems = sortMenuItemsByMenuOrder(menuItems, menuItemDetails);
      return { ...menu, items: sortedItems };
    }),
  );
}

export async function getMenuForMessDayCached({ messId, day }) {
  const cacheKey = `menu_${messId}_${day}`;
  let populatedMenus = await redisClient.get(cacheKey);
  if (populatedMenus) return JSON.parse(populatedMenus);

  const fresh = await fetchMenusForMessDay({ messId, day });
  if (fresh.length === 0) return null;

  await redisClient.set(cacheKey, JSON.stringify(fresh), "EX", 86400);
  return fresh;
}

export async function getMessMenuByDayForUser({ messId, day, userId }) {
  if (!messId || !day) {
    const err = new Error("Mess ID and day are required");
    err.statusCode = 400;
    throw err;
  }

  const populatedMenus = await getMenuForMessDayCached({ messId, day });
  if (!populatedMenus) {
    const err = new Error("Menu not found");
    err.statusCode = 404;
    throw err;
  }

  const userSpecificMenus = populatedMenus.map((m) => ({
    ...m,
    items: withUserLikes(m.items || [], userId),
  }));

  const mess = await Mess.findById(messId).lean();
  const currentDate = getCurrentDate();
  const todayDate = new Date(currentDate);

  let shutdown = null;
  if (mess?.hostelId) {
    shutdown = await MessShutdown.findOne({
      hostelId: mess.hostelId,
      startDate: { $lte: todayDate },
      endDate: { $gte: todayDate },
    }).lean();
  }

  if (shutdown) {
    return {
      isMessClosed: true,
      message: "The mess is shut down for the selected date range.",
      menus: null,
    };
  }

  return { isMessClosed: false, message: null, menus: userSpecificMenus };
}

export async function getMessMenuByDayForAdmin({ messId, day }) {
  if (!messId || !day) {
    const err = new Error("Mess ID and day are required");
    err.statusCode = 400;
    throw err;
  }

  const populatedMenus = await getMenuForMessDayCached({ messId, day });
  if (!populatedMenus) {
    const err = new Error("Menu not found");
    err.statusCode = 404;
    throw err;
  }

  return populatedMenus.map((m) => ({
    ...m,
    items: withAdminLikeCountsOnly(m.items || []),
  }));
}

export async function getTodayMenuForUser({
  userId,
  subscribedHostelId,
  day,
}) {
  if (!subscribedHostelId) {
    return { day, messId: null, isMessClosed: false, menus: [] };
  }

  const messHostel = await Hostel.findById(subscribedHostelId)
    .select("messId")
    .lean();
  const messId = toIdString(messHostel?.messId);

  if (!messId) {
    return { day, messId: null, isMessClosed: false, menus: [] };
  }

  const populatedMenus = await fetchMenusForMessDay({ messId, day });
  const menusWithLikes = populatedMenus.map((m) => ({
    ...m,
    items: withUserLikes(m.items || [], userId),
  }));

  const currentDate = getCurrentDate();
  const todayDate = new Date(currentDate);
  const isClosed = await MessShutdown.findOne({
    hostelId: subscribedHostelId,
    startDate: { $lte: todayDate },
    endDate: { $gte: todayDate },
  }).lean();

  return {
    day,
    messId,
    isMessClosed: !!isClosed,
    message: isClosed
      ? "The mess is shut down for the selected date range."
      : null,
    menus: menusWithLikes,
  };
}

