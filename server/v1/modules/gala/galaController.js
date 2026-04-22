import qrcode from "qrcode";
import mongoose from "mongoose";

import { GalaDinner } from "./galaDinnerModel.js";
import { GalaDinnerMenu, GALA_CATEGORIES } from "./galaDinnerMenuModel.js";
import { GalaDinnerScanLog } from "./galaDinnerScanLogModel.js";
import { Hostel } from "../hostel/hostelModel.js";
import { User } from "../user/userModel.js";
import { MenuItem } from "../mess/menuItemModel.js";
import { QR } from "../qr/qrModel.js";

import { publishGalaScan } from "../../utils/scanBroadcast.js";
import { getCurrentTime } from "../../utils/date.js";

const QR_CODE_DATA_URL_OPTIONS = {
  width: 1024,
  margin: 2,
  type: "image/png",
};

/**
 * HAB: Schedule a new Gala Dinner. Creates one GalaDinner and for each selected
 * hostel 3 GalaDinnerMenus (Starters, Main Course, Desserts) each with a QR code.
 * Body: { date, startersServingStartTime, dinnerServingStartTime, hostelIds: string[] }.
 */
export const scheduleGalaDinner = async (req, res) => {
  try {
    const {
      date,
      startersServingStartTime,
      dinnerServingStartTime,
      hostelIds: hostelIdsRaw,
    } = req.body;
    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }
    if (!startersServingStartTime || !dinnerServingStartTime) {
      return res.status(400).json({
        message:
          "Starters serving start time and Dinner serving start time are required",
      });
    }
    const galaDate = new Date(date);
    if (isNaN(galaDate.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const y = galaDate.getUTCFullYear();
    const m = galaDate.getUTCMonth();
    const d = galaDate.getUTCDate();
    const startOfDay = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
    const existing = await GalaDinner.findOne({
      date: { $gte: startOfDay, $lte: endOfDay },
    });
    if (existing) {
      return res.status(400).json({
        message: "A Gala Dinner is already scheduled on this date.",
      });
    }

    const rawIds = Array.isArray(hostelIdsRaw) ? hostelIdsRaw : [];
    const selectedIds = [
      ...new Set(
        rawIds
          .map((id) => (id != null ? String(id).trim() : ""))
          .filter(Boolean),
      ),
    ];
    if (selectedIds.length === 0) {
      return res.status(400).json({
        message: "At least one hostel must be selected (hostelIds).",
      });
    }
    for (const id of selectedIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid hostel id: ${id}` });
      }
    }

    const hostels = await Hostel.find({ _id: { $in: selectedIds } }).lean();
    if (hostels.length !== selectedIds.length) {
      return res.status(400).json({
        message: "One or more hostel ids were not found.",
      });
    }

    const galaDinner = new GalaDinner({
      date: galaDate,
      startersServingStartTime: String(startersServingStartTime).trim(),
      dinnerServingStartTime: String(dinnerServingStartTime).trim(),
    });
    await galaDinner.save();

    for (const hostel of hostels) {
      for (const category of GALA_CATEGORIES) {
        const menuDoc = new GalaDinnerMenu({
          galaDinnerId: galaDinner._id,
          hostelId: hostel._id,
          category,
        });
        await menuDoc.save();

        const qrPayload = menuDoc._id.toString();
        const qrDataUrl = await qrcode.toDataURL(
          qrPayload,
          QR_CODE_DATA_URL_OPTIONS,
        );
        const qrRecord = new QR({
          qr_string: qrPayload,
          qr_base64: qrDataUrl,
        });
        await qrRecord.save();

        menuDoc.qrCode = qrRecord._id;
        await menuDoc.save();
      }
    }

    return res.status(201).json({
      message: "Gala Dinner scheduled successfully",
      galaDinner: {
        _id: galaDinner._id,
        date: galaDinner.date,
        startersServingStartTime: galaDinner.startersServingStartTime,
        dinnerServingStartTime: galaDinner.dinnerServingStartTime,
        hostelsCount: hostels.length,
        participatingHostelIds: hostels.map((h) => h._id.toString()),
      },
    });
  } catch (error) {
    console.error("scheduleGalaDinner:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * HAB: Delete a Gala Dinner and all related data (menus, items, scan logs, QRs).
 */
export const deleteGalaDinner = async (req, res) => {
  try {
    const { galaDinnerId } = req.params;
    if (!galaDinnerId) {
      return res.status(400).json({ message: "Gala Dinner ID is required" });
    }

    const gala = await GalaDinner.findById(galaDinnerId);
    if (!gala) {
      return res.status(404).json({ message: "Gala Dinner not found" });
    }

    const menus = await GalaDinnerMenu.find({ galaDinnerId: gala._id });
    const menuIds = menus.map((m) => m._id);
    const qrIds = menus.map((m) => m.qrCode).filter(Boolean);

    await MenuItem.deleteMany({ galaMenuId: { $in: menuIds } });
    await GalaDinnerScanLog.deleteMany({ galaDinnerId: gala._id });
    await GalaDinnerMenu.deleteMany({ galaDinnerId: gala._id });
    await QR.deleteMany({ _id: { $in: qrIds } });
    await GalaDinner.findByIdAndDelete(gala._id);

    return res
      .status(200)
      .json({ message: "Gala Dinner cleared successfully" });
  } catch (error) {
    console.error("deleteGalaDinner:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * HAB: Get Gala Dinner detail for a hostel: scan counts (Starters, Main Course, Dessert)
 * and the 3 menus with items.
 */
export const getGalaDinnerDetailForHostel = async (req, res) => {
  try {
    const { galaDinnerId } = req.params;
    const hostelId = req.query.hostelId || req.params.hostelId;
    if (!galaDinnerId || !hostelId) {
      return res.status(400).json({
        message: "Gala Dinner ID and Hostel ID are required",
      });
    }

    const gala = await GalaDinner.findById(galaDinnerId).lean();
    if (!gala) {
      return res.status(404).json({ message: "Gala Dinner not found" });
    }

    const logs = await GalaDinnerScanLog.find({
      galaDinnerId,
    }).lean();

    const startersUserIds = logs
      .filter((l) => l.startersScanned)
      .map((l) => l.userId);
    const mainCourseUserIds = logs
      .filter((l) => l.mainCourseScanned)
      .map((l) => l.userId);
    const dessertsUserIds = logs
      .filter((l) => l.dessertsScanned)
      .map((l) => l.userId);

    const [startersCount, mainCourseCount, dessertsCount] = await Promise.all([
      User.countDocuments({
        _id: { $in: startersUserIds },
        curr_subscribed_mess: hostelId,
      }),
      User.countDocuments({
        _id: { $in: mainCourseUserIds },
        curr_subscribed_mess: hostelId,
      }),
      User.countDocuments({
        _id: { $in: dessertsUserIds },
        curr_subscribed_mess: hostelId,
      }),
    ]);

    const menus = await GalaDinnerMenu.find({
      galaDinnerId,
      hostelId,
    })
      .populate("qrCode", "qr_base64 qr_string")
      .lean();

    const menusWithItems = await Promise.all(
      menus.map(async (m) => {
        const items = await MenuItem.find({ galaMenuId: m._id }).lean();
        return { ...m, items };
      }),
    );

    return res.status(200).json({
      galaDinner: gala,
      hostelId,
      scanStats: {
        startersCount,
        mainCourseCount,
        dessertsCount,
      },
      menus: menusWithItems,
    });
  } catch (error) {
    console.error("getGalaDinnerDetailForHostel:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * HAB: List all Gala Dinners (scheduled and completed), sorted by date desc.
 * Each item includes participatingHostelIds derived from GalaDinnerMenu rows.
 */
export const listGalaDinners = async (req, res) => {
  try {
    const list = await GalaDinner.find().sort({ date: -1 }).lean();
    if (list.length === 0) {
      return res.status(200).json([]);
    }
    const galaIds = list.map((g) => g._id);
    const menuRows = await GalaDinnerMenu.find({
      galaDinnerId: { $in: galaIds },
    })
      .select("galaDinnerId hostelId")
      .lean();
    const hostelIdsByGala = new Map();
    for (const row of menuRows) {
      const gid = row.galaDinnerId.toString();
      if (!hostelIdsByGala.has(gid)) {
        hostelIdsByGala.set(gid, new Set());
      }
      hostelIdsByGala.get(gid).add(row.hostelId.toString());
    }
    const enriched = list.map((g) => {
      const set = hostelIdsByGala.get(g._id.toString());
      return {
        ...g,
        participatingHostelIds: set ? Array.from(set) : [],
      };
    });
    return res.status(200).json(enriched);
  } catch (error) {
    console.error("listGalaDinners:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * Get the next upcoming Gala Dinner (date >= today). For app and SMC.
 */
export const getUpcomingGalaDinner = async (req, res) => {
  try {
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
      return res.status(200).json(null);
    }
    return res.status(200).json(upcoming);
  } catch (error) {
    console.error("getUpcomingGalaDinner:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * Get upcoming Gala Dinner with 3 menus for a hostel (with QR and items).
 * For SMC: hostelId from req.hostel (hostel token) or req.user.hostel (user token).
 * For app: pass hostelId in query.
 */
export const getUpcomingGalaWithMenusForHostel = async (req, res) => {
  try {
    const hostelId =
      req.query.hostelId ||
      req.params.hostelId ||
      (req.hostel && req.hostel._id?.toString()) ||
      (req.user && req.user.hostel && req.user.hostel.toString());
    if (!hostelId) {
      return res.status(400).json({ message: "Hostel ID is required" });
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const gala = await GalaDinner.findOne({
      date: { $gte: startOfToday },
    })
      .sort({ date: 1 })
      .lean();

    if (!gala) {
      return res.status(200).json({ galaDinner: null, menus: [] });
    }

    const menus = await GalaDinnerMenu.find({
      galaDinnerId: gala._id,
      hostelId,
    })
      .populate("qrCode", "qr_base64 qr_string")
      .lean();

    const menusWithItems = await Promise.all(
      menus.map(async (m) => {
        const items = await MenuItem.find({ galaMenuId: m._id }).lean();
        return { ...m, items };
      }),
    );

    if (!menusWithItems.length) {
      return res.status(200).json({ galaDinner: null, menus: [] });
    }

    return res.status(200).json({
      galaDinner: gala,
      menus: menusWithItems,
    });
  } catch (error) {
    console.error("getUpcomingGalaWithMenusForHostel:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * App: Scan Gala QR. Body: { userId, galaDinnerMenuId, expectedCategory }.
 * galaDinnerMenuId is the payload from the QR (GalaDinnerMenu._id).
 * expectedCategory: "Starters" | "Main Course" | "Desserts".
 */
export const galaScan = async (req, res) => {
  try {
    const { userId, galaDinnerMenuId, expectedCategory } = req.body;

    if (!userId || !galaDinnerMenuId || !expectedCategory) {
      return res.status(400).json({
        message: "userId, galaDinnerMenuId and expectedCategory are required",
        success: false,
      });
    }

    if (!GALA_CATEGORIES.includes(expectedCategory)) {
      return res.status(400).json({
        message: "Invalid expectedCategory",
        success: false,
      });
    }

    const galaMenu =
      await GalaDinnerMenu.findById(galaDinnerMenuId).populate("galaDinnerId");
    if (!galaMenu) {
      return res.status(404).json({
        message: "Invalid QR code",
        success: false,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    const userHostelId = user.curr_subscribed_mess?.toString();
    const menuHostelId = galaMenu.hostelId?.toString();
    if (!userHostelId || userHostelId !== menuHostelId) {
      return res.status(400).json({
        message: "You are not subscribed to this hostel's Gala Dinner",
        success: false,
      });
    }

    if (galaMenu.category !== expectedCategory) {
      return res.status(400).json({
        message: `Wrong QR: you scanned ${galaMenu.category} in ${expectedCategory} scanner`,
        success: false,
      });
    }

    const galaDinnerId = galaMenu.galaDinnerId._id || galaMenu.galaDinnerId;

    let log = await GalaDinnerScanLog.findOne({
      userId,
      galaDinnerId,
    });

    if (!log) {
      log = new GalaDinnerScanLog({
        userId,
        galaDinnerId,
      });
    }

    const timeStr = getCurrentTime();
    let alreadyScanned = false;

    if (expectedCategory === "Starters") {
      if (log.startersScanned) alreadyScanned = true;
      else {
        log.startersScanned = true;
        log.startersTime = timeStr;
      }
    } else if (expectedCategory === "Main Course") {
      if (log.mainCourseScanned) alreadyScanned = true;
      else {
        log.mainCourseScanned = true;
        log.mainCourseTime = timeStr;
      }
    } else {
      if (log.dessertsScanned) alreadyScanned = true;
      else {
        log.dessertsScanned = true;
        log.dessertsTime = timeStr;
      }
    }

    if (alreadyScanned) {
      const existingTime =
        expectedCategory === "Starters"
          ? log.startersTime
          : expectedCategory === "Main Course"
            ? log.mainCourseTime
            : log.dessertsTime;
      return res.status(200).json({
        message: `Already scanned for ${expectedCategory}`,
        success: false,
        mealType: expectedCategory,
        time: existingTime,
        alreadyScanned: true,
      });
    }

    await log.save();

    // Broadcast to connected manager clients for this hostel (cluster-safe via Redis pub/sub when REDIS_URL is set)
    try {
      publishGalaScan({
        hostelId: menuHostelId,
        mealType: expectedCategory,
        user: {
          _id: user._id,
          name: user.name,
          rollNumber: user.rollNumber,
        },
        time: timeStr,
        alreadyScanned: false,
      });
    } catch (e) {
      console.error("publishGalaScan failed:", e);
    }

    return res.status(200).json({
      message: "Scan successful",
      success: true,
      mealType: expectedCategory,
      time: timeStr,
      alreadyScanned: false,
      user: {
        _id: user._id,
        name: user.name,
        rollNumber: user.rollNumber,
      },
    });
  } catch (error) {
    console.error("galaScan:", error);
    return res.status(500).json({
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
};

/**
 * App: Get scan status for a user and upcoming Gala Dinner (for tick + time).
 */
export const getGalaScanStatus = async (req, res) => {
  try {
    const userId =
      req.params.userId ||
      (req.user && req.user._id && req.user._id.toString());
    if (!userId) {
      return res.status(400).json({ message: "UserId is required" });
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const gala = await GalaDinner.findOne({
      date: { $gte: startOfToday },
    })
      .sort({ date: 1 })
      .lean();

    if (!gala) {
      return res.status(200).json({ galaDinner: null, scanLog: null });
    }

    const user = await User.findById(userId)
      .select("curr_subscribed_mess")
      .lean();
    const subscribedHostelId = user?.curr_subscribed_mess?.toString();
    if (!subscribedHostelId) {
      return res.status(200).json({ galaDinner: null, scanLog: null });
    }
    const participates = await GalaDinnerMenu.exists({
      galaDinnerId: gala._id,
      hostelId: subscribedHostelId,
    });
    if (!participates) {
      return res.status(200).json({ galaDinner: null, scanLog: null });
    }

    const scanLog = await GalaDinnerScanLog.findOne({
      userId,
      galaDinnerId: gala._id,
    }).lean();

    return res.status(200).json({
      galaDinner: gala,
      scanLog: scanLog || null,
    });
  } catch (error) {
    console.error("getGalaScanStatus:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * Mess-manager (HABit HQ): summary for the next upcoming Gala Dinner for the
 * manager's hostel: total scans per course and recent scans per course.
 * Requires authenticateMessManagerJWT to set req.managerHostel.
 */
export const getManagerGalaSummary = async (req, res) => {
  try {
    const managerHostel = req.managerHostel;
    if (!managerHostel) {
      return res
        .status(400)
        .json({ message: "Manager hostel context not found" });
    }

    const hostelId = managerHostel._id.toString();

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfTomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );

    // Only consider Gala Dinner scheduled for "today" (manager app requirement)
    const gala = await GalaDinner.findOne({
      date: { $gte: startOfToday, $lt: startOfTomorrow },
    })
      .sort({ date: 1 })
      .lean();

    if (!gala) {
      return res.status(200).json({
        galaDinner: null,
        hostelId,
        totals: { starters: 0, mainCourse: 0, desserts: 0 },
        recent: { starters: [], mainCourse: [], desserts: [] },
      });
    }

    const hostelParticipates = await GalaDinnerMenu.exists({
      galaDinnerId: gala._id,
      hostelId,
    });
    if (!hostelParticipates) {
      return res.status(200).json({
        galaDinner: null,
        hostelId,
        totals: { starters: 0, mainCourse: 0, desserts: 0 },
        recent: { starters: [], mainCourse: [], desserts: [] },
      });
    }

    // Fetch all scan logs for this gala, with user populated to filter by hostel.
    const logs = await GalaDinnerScanLog.find({
      galaDinnerId: gala._id,
    })
      .populate("userId", "name rollNumber curr_subscribed_mess")
      .lean();

    const totals = { starters: 0, mainCourse: 0, desserts: 0 };
    const recent = {
      starters: [],
      mainCourse: [],
      desserts: [],
    };

    logs.forEach((log) => {
      const user = log.userId || {};
      // Ensure this scan belongs to the manager's hostel.
      if (
        !user.curr_subscribed_mess ||
        user.curr_subscribed_mess.toString() !== hostelId
      ) {
        return;
      }

      const base = {
        userId: user._id || user.id || log.userId,
        name: user.name || "",
        rollNumber: user.rollNumber || "",
      };

      if (log.startersScanned) {
        totals.starters += 1;
        if (log.startersTime) {
          recent.starters.push({
            ...base,
            time: log.startersTime,
          });
        }
      }
      if (log.mainCourseScanned) {
        totals.mainCourse += 1;
        if (log.mainCourseTime) {
          recent.mainCourse.push({
            ...base,
            time: log.mainCourseTime,
          });
        }
      }
      if (log.dessertsScanned) {
        totals.desserts += 1;
        if (log.dessertsTime) {
          recent.desserts.push({
            ...base,
            time: log.dessertsTime,
          });
        }
      }
    });

    const sortByTimeDesc = (arr) =>
      arr.sort((a, b) => new Date(b.time) - new Date(a.time));
    sortByTimeDesc(recent.starters);
    sortByTimeDesc(recent.mainCourse);
    sortByTimeDesc(recent.desserts);

    return res.status(200).json({
      galaDinner: gala,
      hostelId,
      totals,
      recent,
    });
  } catch (error) {
    console.error("getManagerGalaSummary:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * SMC: Create a Gala menu item. Body: { galaMenuId, name, type }.
 */
export const createGalaMenuItem = async (req, res) => {
  try {
    const { galaMenuId, name, type } = req.body;
    if (!galaMenuId || !name || !type) {
      return res.status(400).json({
        message: "galaMenuId, name and type are required",
      });
    }

    const hostelId =
      req.hostel?._id?.toString() ||
      (req.user?.hostel && req.user.hostel.toString());
    if (!hostelId) {
      return res.status(403).json({
        message: "Unauthorized: SMC hostel context required",
      });
    }

    const galaMenu = await GalaDinnerMenu.findOne({
      _id: galaMenuId,
      hostelId,
    });
    if (!galaMenu) {
      return res.status(404).json({
        message: "Gala menu not found or not for your hostel",
      });
    }

    const newItem = new MenuItem({
      galaMenuId,
      name,
      type,
    });
    await newItem.save();

    return res.status(201).json(newItem);
  } catch (error) {
    console.error("createGalaMenuItem:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * Get menu items for a single Gala menu (by galaDinnerMenuId). Used to refresh one menu after add/update/delete.
 */
export const getGalaMenuItems = async (req, res) => {
  try {
    const { galaDinnerMenuId } = req.params;
    if (!galaDinnerMenuId) {
      return res.status(400).json({ message: "galaDinnerMenuId is required" });
    }

    const items = await MenuItem.find({ galaMenuId: galaDinnerMenuId }).lean();
    return res.status(200).json(items);
  } catch (error) {
    console.error("getGalaMenuItems:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * SMC: Update a Gala menu item. Body: { _Id, name?, type? }.
 */
export const updateGalaMenuItem = async (req, res) => {
  try {
    const { _Id, name, type } = req.body;
    if (!_Id) {
      return res.status(400).json({ message: "_Id is required" });
    }

    const hostelId =
      req.hostel?._id?.toString() ||
      (req.user?.hostel && req.user.hostel.toString());
    if (!hostelId) {
      return res.status(403).json({
        message: "Unauthorized: SMC hostel context required",
      });
    }

    const item = await MenuItem.findById(_Id);
    if (!item || !item.galaMenuId) {
      return res.status(404).json({ message: "Gala menu item not found" });
    }

    const galaMenu = await GalaDinnerMenu.findOne({
      _id: item.galaMenuId,
      hostelId,
    });
    if (!galaMenu) {
      return res.status(403).json({
        message: "This menu item does not belong to your hostel",
      });
    }

    if (name != null) item.name = name;
    if (type != null) item.type = type;
    await item.save();

    return res.status(200).json({
      message: "Menu item updated successfully",
      menuItem: item,
    });
  } catch (error) {
    console.error("updateGalaMenuItem:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/**
 * SMC: Delete a Gala menu item.
 */
export const deleteGalaMenuItem = async (req, res) => {
  try {
    const _Id = req.body._Id || req.params._Id;
    if (!_Id) {
      return res.status(400).json({ message: "_Id is required" });
    }

    const hostelId =
      req.hostel?._id?.toString() ||
      (req.user?.hostel && req.user.hostel.toString());
    if (!hostelId) {
      return res.status(403).json({
        message: "Unauthorized: SMC hostel context required",
      });
    }

    const item = await MenuItem.findById(_Id);
    if (!item || !item.galaMenuId) {
      return res.status(404).json({ message: "Gala menu item not found" });
    }

    const galaMenu = await GalaDinnerMenu.findOne({
      _id: item.galaMenuId,
      hostelId,
    });
    if (!galaMenu) {
      return res.status(403).json({
        message: "This menu item does not belong to your hostel",
      });
    }

    await MenuItem.findByIdAndDelete(_Id);
    return res.status(200).json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("deleteGalaMenuItem:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
