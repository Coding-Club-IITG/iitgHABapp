import qrcode from "qrcode";
import mongoose from "mongoose";

import { Mess } from "./messModel.js";
import { MessWorker } from "./messWorkerModel.js";
import { Menu } from "./menuModel.js";
import { MenuItem } from "./menuItemModel.js";
import { User } from "../user/userModel.js";
import { Hostel } from "../hostel/hostelModel.js";
import { ScanLogs } from "./ScanLogsModel.js";
import MessBill from "./messBillModel.js";
import Leave from "../leave/leaveModel.js";
import { QR } from "../qr/qrModel.js";
import ExcelJS from "exceljs";
import {
  uploadReportToOnedrive,
  downloadFromOnedrive,
} from "../../utils/onedriveController.js";
import { buildMessBillExcelWorkbook } from "./messBillExcelGenerator.js";
import { MessShutdown } from "./messShutdownModel.js";

import { publishMessScan } from "../../utils/scanBroadcast.js";
import redisClient from "../../utils/redisClient.js";
import { sortMenuItemsByMenuOrder } from "../../utils/sortMenuItemsByMenuOrder.js";

const QR_CODE_DATA_URL_OPTIONS = {
  width: 1024,
  margin: 2,
  type: "image/png",
};

import {
  getCurrentDate,
  getCurrentTime,
  getCurrentDay,
} from "../../utils/date.js";

/** Round half-up to 2 decimal places (matches OPI job + getAllMessInfo $round). */
function roundToTwoDecimals(n) {
  if (n == null || n === "") return 0;
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.round(v * 100) / 100;
}

export const createMess = async (req, res) => {
  try {
    const { name, hostelId } = req.body;

    const newMess = new Mess({
      name,
      hostelId,
    });
    const hostelRes = await Hostel.findByIdAndUpdate(
      hostelId,
      { messId: newMess._id },
      { new: true },
    );
    if (!hostelRes) {
      return res.status(404).json({ message: "Hostel not found" });
    }
    await newMess.save();
    const qrDataUrl = await qrcode.toDataURL(
      newMess._id.toString(),
      QR_CODE_DATA_URL_OPTIONS,
    );
    const QRres = new QR({
      qr_string: newMess._id.toString(),
      qr_base64: qrDataUrl,
    });
    await QRres.save();
    newMess.qrCode = QRres._id;
    await newMess.save();

    await redisClient.del("all_mess_info");

    return res.status(201).json(newMess);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const createMessWithoutHostel = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Mess name is required" });
    }

    const newMess = new Mess({ name });
    await newMess.save();
    const qrDataUrl = await qrcode.toDataURL(
      newMess._id.toString(),
      QR_CODE_DATA_URL_OPTIONS,
    );
    const QRres = new QR({
      qr_string: newMess._id.toString(),
      qr_base64: qrDataUrl,
    });
    await QRres.save();
    newMess.qrCode = QRres._id;
    await newMess.save();
    return res.status(201).json(newMess);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Deletion of mess/caterer has been disabled. The delete endpoint and controller were removed.

export const createMenu = async (req, res) => {
  try {
    const {
      messId,
      day,
      BstartTime,
      BendTime,
      LstartTime,
      LendTime,
      DstartTime,
      DendTime,
    } = req.body;
    const typeOptions = ["Breakfast", "Lunch", "Dinner"];
    const newMenuB = new Menu({
      messId,
      day,
      startTime: BstartTime,
      endTime: BendTime,
      type: typeOptions[0],
    });
    await newMenuB.save();
    const newMenuL = new Menu({
      messId,
      day,
      startTime: LstartTime,
      endTime: LendTime,
      type: typeOptions[1],
    });
    await newMenuL.save();
    const newMenuD = new Menu({
      messId,
      day,
      startTime: DstartTime,
      endTime: DendTime,
      type: typeOptions[2],
    });

    await newMenuD.save();
    return res.status(201).json(newMenuB);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteMenu = async (req, res) => {
  try {
    const menuId = req.params.menuId;
    const deletedMenu = await Menu.findByIdAndDelete(menuId);
    if (!deletedMenu) {
      return res.status(404).json({ message: "Menu not found" });
    }
    return res.status(200).json({ message: "Menu deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createMenuItem = async (req, res) => {
  try {
    var { name, type, meal, day, messId } = req.body;
    const menuId = new mongoose.Types.ObjectId();
    const newMenuItem = new MenuItem({
      menuId,
      name,
      type,
    });
    const newItem = await newMenuItem.save();
    let menu = await Menu.findOne({ messId: messId, day: day, type: meal });
    if (!menu) {
      const newMenu = new Menu({
        messId,
        day,
        type: meal,
      });
      await newMenu.save();
      menu = newMenu;
    }

    menu.items.push(newItem._id);
    await menu.save();
    await redisClient.del(`menu_${messId}_${day}`);
    return res.status(201).json(newItem);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteMenuItem = async (req, res) => {
  try {
    const _Id = req.body._Id;
    const menuToInvalidate = await Menu.findOne({ items: _Id });
    const deletedMenuItem = await MenuItem.findByIdAndDelete(_Id);
    if (!deletedMenuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    if (menuToInvalidate) {
      await redisClient.del(
        `menu_${menuToInvalidate.messId}_${menuToInvalidate.day}`,
      );
    }
    /*const menu = await Menu.findById(deletedMenuItem.menuId);
    if (!menu) {
      return res.status(404).json({ message: "Menu not found" });
    }
    menu.items = menu.items.filter((item) => item.toString() !== menuItemId);*/

    return res.status(200).json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserMessInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const messHostelId = user.curr_subscribed_mess;
    if (!messHostelId) {
      // User doesn't have a mess subscription yet (e.g., Apple-only user)
      return res.status(404).json({ message: "No mess subscription found" });
    }
    const messHostel = await Hostel.findById(messHostelId);
    if (!messHostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }
    const messId = messHostel.messId;
    if (!messId) {
      return res.status(404).json({ message: "Mess ID not found" });
    }
    const messInfo = await Mess.findById(messId);
    if (!messInfo) {
      return res.status(404).json({ message: "Mess not found" });
    }
    const messObj = messInfo.toObject();
    messObj.rating =
      messObj.rating != null ? roundToTwoDecimals(messObj.rating) : 0;
    messObj.ranking = messObj.ranking != null ? Math.round(messObj.ranking) : 0;
    messObj.feedbackPercentage =
      messObj.feedbackPercentage != null
        ? roundToTwoDecimals(messObj.feedbackPercentage)
        : 0;
    return res.status(200).json(messObj);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllMessInfo = async (req, res) => {
  try {
    const cachedData = await redisClient.get("all_mess_info");
    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    const messesWithHostelName = await Mess.aggregate([
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

    if (!messesWithHostelName || messesWithHostelName.length === 0) {
      return res.status(404).json({ message: "No mess found" });
    }

    await redisClient.set(
      "all_mess_info",
      JSON.stringify(messesWithHostelName),
      "EX",
      300,
    );
    return res.status(200).json(messesWithHostelName);
  } catch (error) {
    console.error("Error in getAllMessInfo:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const mess = await Mess.findById(id);
    if (!mess) {
      return res.status(404).json({ message: "Mess not found" });
    }
    const messObj = mess.toObject();
    if (messObj.hostelId) {
      const hostel = await Hostel.findById(messObj.hostelId);
      messObj.hostelName = hostel ? hostel.hostel_name : null;
    } else {
      messObj.hostelName = null;
    }
    const qr_img = await QR.findById(messObj.qrCode);
    messObj.qr_img = qr_img ? qr_img.qr_base64 : null;
    return res.status(200).json(messObj);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessMenuByDay = async (req, res) => {
  try {
    const messId = req.params.messId;
    const day = req.body.day;
    const userId = req.user.id;

    if (!messId || !day) {
      return res.status(400).json({ message: "Mess ID and day are required" });
    }

    const cacheKey = `menu_${messId}_${day}`;
    let populatedMenus = await redisClient.get(cacheKey);
    if (populatedMenus) populatedMenus = JSON.parse(populatedMenus);

    if (!populatedMenus) {
      const menu = await Menu.find({ messId, day }).sort({ startTime: 1 });
      if (!menu || menu.length === 0) {
        return res.status(404).json({ message: "Menu not found" });
      }

      populatedMenus = await Promise.all(
        menu.map(async (m) => {
          const menuObj = m.toObject();
          const menuItems = menuObj.items;
          const menuItemDetails = await MenuItem.find({
            _id: { $in: menuItems },
          }).lean();

          menuObj.items = sortMenuItemsByMenuOrder(menuItems, menuItemDetails);
          return menuObj;
        }),
      );

      await redisClient.set(
        cacheKey,
        JSON.stringify(populatedMenus),
        "EX",
        86400,
      );
    }

    // Apply user-specific logic (likes) to cached data
    const userSpecificMenus = populatedMenus.map((m) => {
      const mClone = { ...m };
      mClone.items = m.items.map((item) => {
        return {
          ...item,
          isLiked:
            item.likes &&
            item.likes.some((id) => id.toString() === userId.toString()),
          likesCount: item.likes ? item.likes.length : 0,
          likes: undefined, // Hide massive array
        };
      });
      return mClone;
    });

    // Check if the mess is shut down today
    const mess = await Mess.findById(messId);
    const currentDate = getCurrentDate();
    const todayDate = new Date(currentDate);
    let shutdown = null;
    if (mess && mess.hostelId) {
      shutdown = await MessShutdown.findOne({
        hostelId: mess.hostelId,
        startDate: { $lte: todayDate },
        endDate: { $gte: todayDate },
      }).lean();
    }

    if (shutdown) {
      return res.status(200).json({
        isMessClosed: true,
        message: "The mess is shut down for the selected date range.",
      });
    }

    return res.status(200).json(userSpecificMenus);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessMenuByDayForAdminHAB = async (req, res) => {
  try {
    const messId = req.params.messId;
    const day = req.body.day;

    if (!messId || !day) {
      return res.status(400).json({ message: "Mess ID and day are required" });
    }

    const cacheKey = `menu_${messId}_${day}`;
    let populatedMenus = await redisClient.get(cacheKey);
    if (populatedMenus) populatedMenus = JSON.parse(populatedMenus);

    if (!populatedMenus) {
      const menu = await Menu.find({ messId, day }).sort({ startTime: 1 });
      if (!menu || menu.length === 0) {
        return res.status(404).json({ message: "Menu not found" });
      }

      populatedMenus = await Promise.all(
        menu.map(async (m) => {
          const menuObj = m.toObject();
          const menuItems = menuObj.items;
          const menuItemDetails = await MenuItem.find({
            _id: { $in: menuItems },
          }).lean();

          menuObj.items = sortMenuItemsByMenuOrder(menuItems, menuItemDetails);
          return menuObj;
        }),
      );

      await redisClient.set(
        cacheKey,
        JSON.stringify(populatedMenus),
        "EX",
        86400,
      );
    }

    // Apply formatting to cached data
    const specificMenus = populatedMenus.map((m) => {
      const mClone = { ...m };
      mClone.items = m.items.map((item) => {
        return {
          ...item,
          likesCount: item.likes ? item.likes.length : 0,
          likes: undefined, // Hide massive array
        };
      });
      return mClone;
    });

    return res.status(200).json(specificMenus);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessMenuItemById = async (req, res) => {
  try {
    const menuItemId = req.params.menuItemId;
    const userId = req.user.id;

    const menuItem = await MenuItem.findById(menuItemId).lean();

    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    menuItem.isLiked = menuItem.likes.some(
      (id) => id.toString() === userId.toString(),
    );

    return res.status(200).json(menuItem);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const toggleLikeMenuItem = async (req, res) => {
  try {
    const menuItemId = req.params.menuItemId;
    const userId = req.user.id;

    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    if (menuItem.likes.includes(userId)) {
      menuItem.likes = menuItem.likes.filter(
        (id) => id.toString() !== userId.toString(),
      );
      await menuItem.save();
      const menuToInvalidate = await Menu.findOne({ items: menuItemId });
      if (menuToInvalidate) {
        await redisClient.del(
          `menu_${menuToInvalidate.messId}_${menuToInvalidate.day}`,
        );
      }
      return res
        .status(200)
        .json({ message: "Menu item unliked successfully" });
    } else {
      menuItem.likes.push(userId);
      await menuItem.save();
      const menuToInvalidate = await Menu.findOne({ items: menuItemId });
      if (menuToInvalidate) {
        await redisClient.del(
          `menu_${menuToInvalidate.messId}_${menuToInvalidate.day}`,
        );
      }
      return res.status(200).json({ message: "Menu item liked successfully" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// const ScanMess = async (req, res) => {
//   try {
//     const messId = req.params.messId;
//     const messInfo = await Mess.findById(messId);
//     const userId = req.user.id;
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }
//     if (!messInfo) {
//       return res.status(404).json({ message: "Mess not found" });
//     }
//     if (messInfo.hostelId !== user.curr_subscribed_mess) {
//       return res
//         .status(400)
//         .json({ message: "User is not subscribed to this mess" });
//     }
//     if (
//       ScanLogs.find({ userId: userId, messId: messId, date: getCurrentDate() })
//     ) {
//       const time = getCurrentTime();
//       const breakfast = Menu.find({
//         messId: messId,
//         day: getCurrentDay(),
//         type: "Breakfast",
//       });
//       if (time >= breakfast.startTime && time <= breakfast.endTime) {
//         if (!ScanLogs.breakfast) {
//           ScanLogs.breakfast = true;
//           return res.status(200).json({ message: "Breakfast" });
//         } else {
//           return res
//             .status(400)
//             .json({ message: "Already scanned for breakfast" });
//         }
//       }
//       const lunch = Menu.find({
//         messId: messId,
//         day: getCurrentDay(),
//         type: "Lunch",
//       });
//       if (time >= lunch.startTime && time <= lunch.endTime) {
//         if (!ScanLogs.lunch) {
//           ScanLogs.lunch = true;
//           return res.status(200).json({ message: "Lunch" });
//         } else {
//           return res.status(400).json({ message: "Already scanned for lunch" });
//         }
//       }
//       const dinner = Menu.find({
//         messId: messId,
//         day: getCurrentDay(),
//         type: "Dinner",
//       });
//       if (time >= dinner.startTime && time <= dinner.endTime) {
//         if (!ScanLogs.dinner) {
//           ScanLogs.dinner = true;
//           return res.status(200).json({ message: "Dinner" });
//         } else {
//           return res
//             .status(400)
//             .json({ message: "Already scanned for dinner" });
//         }
//       }
//       return res
//         .status(400)
//         .json({ message: "No meals available at this time" });
//     }
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };

export const ScanMess = async (req, res) => {
  try {
    const { userId } = req.body;
    const messInfoId = req.params.messId;

    const messInfo = await Mess.findById(messInfoId);
    if (!messInfo) {
      return res
        .status(404)
        .json({ message: "Mess not found", success: false });
    }

    const currentDate = getCurrentDate();
    const currentTime = getCurrentTime();
    const currentDay = getCurrentDay();

    const shutdownRecord = await MessShutdown.findOne({
      hostelId: messInfo.hostelId,
      startDate: { $lte: new Date(currentDate) },
      endDate: { $gte: new Date(currentDate) },
    }).lean();

    if (shutdownRecord) {
      return res.status(400).json({
        message: "Scan failed: Mess is shut down for the selected dates.",
        success: false,
      });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    const scanner_perms = user.scannerPermission;

    if (scanner_perms === false) {
      return res
        .status(403)
        .json({ message: "Mess Rebate Active", success: false });
    }

    const hostel = await Hostel.findById(user.curr_subscribed_mess).lean();
    if (!hostel) {
      return res
        .status(404)
        .json({ message: "Hostel not found", success: false });
    }

    const messId = hostel.messId;
    const userMess = await Mess.findById(messId).lean();
    if (!userMess) {
      return res
        .status(404)
        .json({ message: "User mess not found", success: false });
    }

    if (messInfo.hostelId.toString() !== user.curr_subscribed_mess.toString()) {
      return res.status(400).json({
        message: "User is not subscribed to this mess",
        success: false,
      });
    }

    let scanLog = await ScanLogs.findOne({ userId, messId, date: currentDate });
    if (!scanLog) {
      scanLog = new ScanLogs({
        userId,
        messId,
        date: currentDate,
        breakfast: false,
        lunch: false,
        dinner: false,
      });
    }

    const todayMenus = await Menu.find({
      messId,
      day: currentDay,
      type: { $in: ["Breakfast", "Lunch", "Dinner"] },
    }).lean();

    const breakfast = todayMenus.find((m) => m.type === "Breakfast");
    const lunch = todayMenus.find((m) => m.type === "Lunch");
    const dinner = todayMenus.find((m) => m.type === "Dinner");

    let mealType = null;
    let alreadyScanned = false;

    if (
      breakfast &&
      currentTime >= breakfast.startTime &&
      currentTime <= breakfast.endTime
    ) {
      mealType = "Breakfast";
      if (scanLog.breakfast) alreadyScanned = true;
      else {
        scanLog.breakfast = true;
        // Set breakfastTime in Kolkata timezone
        scanLog.breakfastTime = new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        );
      }
    } else if (
      lunch &&
      currentTime >= lunch.startTime &&
      currentTime <= lunch.endTime
    ) {
      mealType = "Lunch";
      if (scanLog.lunch) alreadyScanned = true;
      else {
        scanLog.lunch = true;
        scanLog.lunchTime = new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        );
      }
    } else if (
      dinner &&
      currentTime >= dinner.startTime &&
      currentTime <= dinner.endTime
    ) {
      mealType = "Dinner";
      if (scanLog.dinner) alreadyScanned = true;
      else {
        scanLog.dinner = true;
        scanLog.dinnerTime = new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        );
      }
    }
    console.log("Scan Log:", scanLog);
    if (alreadyScanned) {
      const logDate = formatDate(scanLog.date);
      const logTime = formatTime2(scanLog[`${mealType.toLowerCase()}Time`]);
      console.log("Already scanned logTime:", logTime);
      console.log("Already scanned logDate:", logDate);
      return res.status(200).json({
        message: `Already scanned for ${mealType.toLowerCase()}`,
        success: false,
        mealType,
        time: logTime,
        date: logDate,
      });
    }

    if (!mealType) {
      return res.status(400).json({
        message: "No meals available at this time",
        success: false,
        time: formatTime(new Date()),
        date: formatDate(new Date()),
      });
    }

    await scanLog.save();

    // Get current time in Kolkata timezone
    const kolkataTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );

    // Broadcast to connected mess-manager WebSocket clients (cluster-safe via Redis pub/sub when REDIS_URL is set)
    try {
      publishMessScan({
        hostelId: hostel._id.toString(),
        messId: messId.toString(),
        mealType,
        user: {
          _id: user._id,
          name: user.name,
          rollNumber: user.rollNumber,
        },
        time: kolkataTime,
      });
    } catch (e) {
      console.error("Failed to broadcast mess scan to managers:", e);
    }

    return res.status(200).json({
      message: "Scan successful",
      success: true,
      mealType,
      time: formatTime2(kolkataTime),
      date: formatDate(kolkataTime),
      user: {
        name: user.name,
        rollNumber: user.rollNumber,
        photo:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=1000&q=80",
        hostel: user.hostel,
        year: user.year,
        degree: user.degree,
      },
    });
  } catch (error) {
    console.error("Error in ScanMess:", error);
    return res.status(500).json({
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
};

const formatDate = (date) => {
  const dateObj = new Date(date);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${dateObj.getDate()} ${
    months[dateObj.getMonth()]
  } ${dateObj.getFullYear()}`;
};

export const getUnassignedMess = async (req, res) => {
  try {
    const unassignedMesses = await Mess.find({ hostelId: null });
    res.status(200).json(unassignedMesses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const assignMessToHostel = async (req, res) => {
  try {
    const messId = req.params.messId;
    const hostelId = req.body.hostelId;
    const oldMessId = req.body.oldMessId;

    const newMess = await Mess.findByIdAndUpdate(
      messId,
      { hostelId: hostelId },
      { hostel_name: req.body.hostelName },
      { new: true },
    );
    if (!newMess) {
      return res.status(404).json({ message: "Mess not found" });
    }

    if (oldMessId) {
      const oldMess = await Mess.findByIdAndUpdate(
        oldMessId,
        { hostelId: null },
        { hostel_name: null },
        { new: true },
      );
      if (!oldMess) {
        return res.status(404).json({ message: "Old mess not found" });
      }
    }

    const hostelRes = await Hostel.findByIdAndUpdate(
      hostelId,
      { messId: messId },
      { new: true },
    );

    if (!hostelRes) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    return res.status(200).json({
      message: "Mess assigned to hostel successfully",
      mess: newMess,
      hostel: hostelRes,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const changeHostel = async (req, res) => {
  try {
    const messId = req.params.messId;
    const hostelId = req.body.hostelId;
    const oldHostelId = req.body.oldHostelId;

    const newMess = await Mess.findByIdAndUpdate(
      messId,
      { hostelId: hostelId },
      { new: true },
    );
    if (!newMess) {
      return res.status(404).json({ message: "Mess not found" });
    }

    const oldHostel = await Hostel.findByIdAndUpdate(
      oldHostelId,
      { messId: null },
      { new: true },
    );
    if (!oldHostel) {
      return res.status(404).json({ message: "Old Hostel not found" });
    }

    const hostelRes = await Hostel.findByIdAndUpdate(
      hostelId,
      { messId: messId },
      { new: true },
    );

    if (!hostelRes) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    return res.status(200).json({
      message: "Mess assigned to hostel successfully",
      mess: newMess,
      hostel: hostelRes,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const unassignMess = async (req, res) => {
  try {
    const messId = req.params.messId;
    console.log("Unassigning mess with ID:", messId);

    // First, get the mess to find which hostel it was assigned to
    const mess = await Mess.findById(messId);
    if (!mess) {
      return res.status(404).json({ message: "Mess not found" });
    }

    const hostelId = mess.hostelId;
    console.log("Mess was assigned to hostel:", hostelId);

    // Update mess to remove hostel assignment
    const updatedMess = await Mess.findByIdAndUpdate(
      messId,
      { hostelId: null },
      { new: true },
    );
    console.log("Updated mess:", updatedMess);

    // Update hostel to remove mess assignment
    if (hostelId) {
      const updatedHostel = await Hostel.findByIdAndUpdate(
        hostelId,
        { messId: null },
        { new: true },
      );
      console.log("Updated hostel:", updatedHostel);
    }

    await redisClient.del("all_mess_info");

    return res.status(200).json({
      message: "Mess unassigned successfully",
      mess: updatedMess,
    });
  } catch (error) {
    console.error("Error in unassignMess:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const formatTime = (time) => {
  const timeObj = new Date(`1970-01-01T${time}:00`);
  const hours = timeObj.getHours();
  const minutes = timeObj.getMinutes();
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
};

const formatTime2 = (time) => {
  const timeObj = new Date(time);
  const hours = timeObj.getHours();
  const minutes = timeObj.getMinutes();
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
};

export const getMessWorkers = async (req, res) => {
  try {
    let query = {};
    if (req.hostel && req.hostel.messId) {
      query.messId = req.hostel.messId;
    }
    const workers = await MessWorker.find(query);
    return res.status(200).json({ workers });
  } catch (error) {
    console.error("Error fetching mess workers:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createMessWorker = async (req, res) => {
  try {
    const { name, designation, rate } = req.body;

    let messId = null;
    if (req.hostel && req.hostel.messId) {
      messId = req.hostel.messId;
    }

    if (!messId) {
      return res
        .status(400)
        .json({ message: "Hostel does not have an active mess assigned." });
    }

    if (!name || !rate) {
      return res
        .status(400)
        .json({ message: "Name and daily wage rate are required" });
    }

    const newWorker = new MessWorker({
      name,
      designation: designation || "Unskilled",
      rate,
      messId,
    });

    await newWorker.save();
    return res.status(201).json(newWorker);
  } catch (error) {
    console.error("Error creating mess worker:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteMessWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const worker = await MessWorker.findByIdAndDelete(id);
    if (!worker) {
      return res.status(404).json({ message: "Mess worker not found" });
    }
    return res
      .status(200)
      .json({ message: "Mess worker deleted successfully" });
  } catch (error) {
    console.error("Error deleting mess worker:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateMessWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, designation, rate } = req.body || {};

    if (!name || !designation || rate === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const parsedRate = Number(rate);
    if (Number.isNaN(parsedRate) || parsedRate < 0) {
      return res.status(400).json({ message: "Invalid rate" });
    }

    const updated = await MessWorker.findByIdAndUpdate(
      id,
      { name: String(name).trim(), designation, rate: parsedRate },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Mess worker not found" });
    }

    return res.status(200).json({ message: "Mess worker updated successfully", worker: updated });
  } catch (error) {
    console.error("Error updating mess worker:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const generateMessBill = async (req, res) => {
  try {
    const { hostelId, billData } = req.body;
    if (!hostelId || !billData || !billData.month || !billData.year) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (req.hostel && req.hostel._id.toString() !== hostelId) {
      return res
        .status(403)
        .json({ message: "Unauthorized to generate bill for another hostel" });
    }

    // Generate an Excel report and upload it to OneDrive.
    // Persist the bill metadata + report URL in MessBill collection.

    const existingBill = await MessBill.findOne({
      hostel: hostelId,
      month: billData.month,
      year: billData.year,
    });
    if (existingBill) {
      return res
        .status(400)
        .json({ message: "Bill for this month already exists" });
    }

    const {
      hostelName,
      month,
      year,
      accountNumber,
      catererName,
      operatingDays,
      shutdownDate, // kept for backward compatibility
      totalSubscribers,
      totalSubscribersOffset,
      messDays,
      rebateDays,
      rebateDaysOffset,
      consumingDays,
      foodCost,
      totalWage,
      messBillClaimed,
      messBill,
      gstAmount,
      tdsAmount,
      firstInstallment,
      secondInstallment,
      rebateReimbursement,
      miscDeduction,
      habTransfer,
      totalExpenditure,
      workerAttendances,
    } = billData;

    const rebateIds = (billData.rebateApplicationIds || [])
      .filter((id) => id && mongoose.isValidObjectId(String(id)))
      .map((id) => new mongoose.Types.ObjectId(String(id)));

    if (rebateIds.length) {
      await Leave.updateMany(
        {
          _id: { $in: rebateIds },
          messHostel: hostelId,
          status: "Acknowledged",
        },
        { $set: { status: "Processed", processedAt: new Date() } },
      );
    }

    const safeMonth = String(month).replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `mess-bill_${hostelId}_${safeMonth}_${year}.xlsx`;

    const messIdForWorkers = req.hostel?.messId || null;
    const fileBuffer = await buildMessBillExcelWorkbook({
      hostelId,
      billData,
      workerAttendances,
      messId: messIdForWorkers,
    });
    const url = await uploadReportToOnedrive(fileBuffer, filename);
    if (!url) {
      return res.status(500).json({
        message: "OneDrive upload failed",
      });
    }

    const newBill = new MessBill({
      hostel: hostelId,
      hostelName,
      month,
      year,
      accountNumber,
      catererName: catererName ?? "",
      operatingDays,
      shutdownDate,
      totalSubscribers,
      totalSubscribersOffset,
      messDays,
      rebateDays,
      rebateDaysOffset,
      consumingDays,
      foodCost,
      totalWage,
      messBillClaimed,
      messBill,
      gstAmount,
      tdsAmount,
      firstInstallment,
      secondInstallment,
      rebateReimbursement,
      miscDeduction,
      habTransfer,
      totalExpenditure,
      workerAttendances,
      billLink: url,
      generatedBy: req.hostel ? req.hostel._id : req.user ? req.user.id : null,
    });

    await newBill.save();

    return res.status(201).json({
      message: "Mess bill report generated and uploaded to OneDrive",
      filename,
      url,
      billId: newBill._id,
    });
  } catch (error) {
    console.error("Error generating mess bill:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessBill = async (req, res) => {
  try {
    const { hostelId, month, year } = req.query;
    if (!hostelId || !month || !year) {
      return res
        .status(400)
        .json({ message: "HostelId, month, and year are required" });
    }

    if (req.hostel && req.hostel._id.toString() !== hostelId) {
      return res
        .status(403)
        .json({ message: "Unauthorized to fetch bill for another hostel" });
    }
    const bill = await MessBill.findOne({ hostel: hostelId, month, year });
    if (!bill) {
      return res.status(200).json(null);
    }
    return res.status(200).json(bill);
  } catch (error) {
    console.error("Error fetching mess bill:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** Stream bill .xlsx with Content-Disposition: attachment (browser saves file, not OneDrive preview). */
export const downloadMessBillFile = async (req, res) => {
  try {
    const { hostelId, month, year } = req.query;
    if (!hostelId || !month || year === undefined || year === "") {
      return res.status(400).json({
        message: "hostelId, month, and year are required",
      });
    }

    if (req.hostel && req.hostel._id.toString() !== hostelId) {
      return res.status(403).json({
        message: "Unauthorized to download bill for another hostel",
      });
    }

    const yearNum = parseInt(String(year), 10);
    const bill = await MessBill.findOne({
      hostel: hostelId,
      month: String(month),
      year: Number.isFinite(yearNum) ? yearNum : year,
    });

    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    const url = bill.billLink?.trim();
    if (!url) {
      return res.status(404).json({ message: "No file link on this bill" });
    }

    const safeMonth = String(month).replace(/[^a-zA-Z0-9_-]/g, "_");
    const y = Number.isFinite(yearNum) ? yearNum : year;
    const filename = `mess-bill_${safeMonth}_${y}.xlsx`;

    return downloadFromOnedrive(url, res, { inline: false, filename });
  } catch (error) {
    console.error("Error downloading mess bill file:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
};

export const getAllMessBillsByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const allHostels = await Hostel.find().lean();
    const bills = await MessBill.find({ month, year }).lean();

    const responseData = allHostels.map((hostel) => {
      const bill = bills.find(
        (b) => b.hostel.toString() === hostel._id.toString(),
      );
      return {
        hostelId: hostel._id,
        hostel_name: hostel.hostel_name,
        isGenerated: !!bill,
        messBillClaimed: bill ? bill.messBillClaimed : 0,
        totalExpenditure: bill ? bill.totalExpenditure : 0,
        billDetails: bill || null,
      };
    });

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching all mess bills by month:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
