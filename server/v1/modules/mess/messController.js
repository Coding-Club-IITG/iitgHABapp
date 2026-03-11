const { Mess } = require("./messModel");
const { Menu } = require("./menuModel");
const { MenuItem } = require("./menuItemModel");
const { User } = require("../user/userModel");
const { Hostel } = require("../hostel/hostelModel");
const { ScanLogs } = require("./ScanLogsModel.js");
const mongoose = require("mongoose");
const { QR } = require("../qr/qrModel.js");
const qrcode = require("qrcode");
const { MessClosure } = require("../hostel/messClosureModel");

const NodeCache = require("node-cache");
const menuCache = new NodeCache({ stdTTL: 300 });
const messInfoCache = new NodeCache({ stdTTL: 300 });

const QR_CODE_DATA_URL_OPTIONS = {
  width: 1024,
  margin: 2,
  type: "image/png",
};

const {
  getCurrentDate,
  getCurrentTime,
  getCurrentDay,
} = require("../../utils/date.js");

const createMess = async (req, res) => {
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

    return res.status(201).json(newMess);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const createMessWithoutHostel = async (req, res) => {
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

const createMenu = async (req, res) => {
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
      BisGala,
      LisGala,
      DisGala,
    } = req.body;
    const typeOptions = ["Breakfast", "Lunch", "Dinner"];
    const newMenuB = new Menu({
      messId,
      day,
      startTime: BstartTime,
      endTime: BendTime,
      isGala: BisGala,
      type: typeOptions[0],
    });
    await newMenuB.save();
    const newMenuL = new Menu({
      messId,
      day,
      startTime: LstartTime,
      endTime: LendTime,
      isGala: LisGala,
      type: typeOptions[1],
    });
    await newMenuL.save();
    const newMenuD = new Menu({
      messId,
      day,
      startTime: DstartTime,
      endTime: DendTime,
      isGala: DisGala,
      type: typeOptions[2],
    });

    await newMenuD.save();
    return res.status(201).json(newMenuB);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const deleteMenu = async (req, res) => {
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

const createMenuItem = async (req, res) => {
  try {
    var { name, type, meal, day, messId } = req.body;
    const menuId = new mongoose.Types.ObjectId();
    const newMenuItem = new MenuItem({
      menuId,
      name,
      type,
    });
    const newItem = await newMenuItem.save();
    const menu = await Menu.findOne({ messId: messId, day: day, type: meal });
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
    return res.status(201).json(newItem);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const deleteMenuItem = async (req, res) => {
  try {
    const _Id = req.body._Id;
    const deletedMenuItem = await MenuItem.findByIdAndDelete(_Id);
    if (!deletedMenuItem) {
      return res.status(404).json({ message: "Menu item not found" });
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

const getUserMessInfo = async (req, res) => {
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
    // Ensure rating and ranking are always integers
    const messObj = messInfo.toObject();
    messObj.rating = messObj.rating ? Math.round(messObj.rating) : 0;
    messObj.ranking = messObj.ranking ? Math.round(messObj.ranking) : 0;
    return res.status(200).json(messObj);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getAllMessInfo = async (req, res) => {
  try {
    const cachedData = messInfoCache.get("all_mess_info");
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const messes = await Mess.find().lean();
    if (!messes || messes.length === 0)
      return res.status(404).json({ message: "No mess found" });

    const userCounts = await User.aggregate([
      { $match: { curr_subscribed_mess: { $ne: null } } },
      { $group: { _id: "$curr_subscribed_mess", count: { $sum: 1 } } },
    ]);

    // Create a fast lookup map
    const countMap = userCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    const hostels = await Hostel.find({
      _id: { $in: messes.map((m) => m.hostelId).filter(Boolean) },
    }).lean();
    const hostelMap = hostels.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.hostel_name;
      return acc;
    }, {});

    const messesWithHostelName = messes.map((mess) => {
      return {
        ...mess,
        hostelName: mess.hostelId
          ? hostelMap[mess.hostelId.toString()] || null
          : null,
        rating: mess.rating ? Math.round(mess.rating) : 0,
        ranking: mess.ranking ? Math.round(mess.ranking) : 0,
        user_count: mess.hostelId ? countMap[mess.hostelId.toString()] || 0 : 0,
      };
    });

    messInfoCache.set("all_mess_info", messesWithHostelName);

    return res.status(200).json(messesWithHostelName);
  } catch (error) {
    console.error("Error in getAllMessInfo:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getMessInfo = async (req, res) => {
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

const getMessMenuByDay = async (req, res) => {
  try {
    const messId = req.params.messId;
    const day = req.body.day;
    const userId = req.user.id;

    if (!messId || !day) {
      return res.status(400).json({ message: "Mess ID and day are required" });
    }

    const cacheKey = `menu_${messId}_${day}`;
    let populatedMenus = menuCache.get(cacheKey);

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

          menuObj.items = menuItemDetails;
          return menuObj;
        }),
      );

      menuCache.set(cacheKey, populatedMenus);
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

    // Check if the mess is closed today
    const mess = await Mess.findById(messId);
    const currentDate = getCurrentDate();
    const todayDate = new Date(currentDate);
    let isClosed = null;
    if (mess && mess.hostelId) {
      isClosed = await MessClosure.findOne({
        hostelId: mess.hostelId,
        closureDate: todayDate,
      }).lean();
    }

    if (isClosed) {
      return res.status(200).json({
        isMessClosed: true,
        message: "The mess is closed today as per the monthly schedule.",
      });
    }

    return res.status(200).json(userSpecificMenus);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getMessMenuByDayForAdminHAB = async (req, res) => {
  try {
    const messId = req.params.messId;
    const day = req.body.day;

    if (!messId || !day) {
      return res.status(400).json({ message: "Mess ID and day are required" });
    }

    const cacheKey = `menu_${messId}_${day}`;
    let populatedMenus = menuCache.get(cacheKey);

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

          menuObj.items = menuItemDetails;
          return menuObj;
        }),
      );

      menuCache.set(cacheKey, populatedMenus);
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

const getMessMenuItemById = async (req, res) => {
  try {
    const menuItemId = req.params.menuItemId;
    const menuItemDoc = await MenuItem.findById(menuItemId);
    const userId = req.user.id;

    if (!menuItemDoc) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    const menuItem = menuItemDoc.toObject(); // Convert to plain object
    menuItem.isLiked = menuItem.likes.includes(userId);

    return res.status(200).json(menuItem);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const toggleLikeMenuItem = async (req, res) => {
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
      return res
        .status(200)
        .json({ message: "Menu item unliked successfully" });
    } else {
      menuItem.likes.push(userId);
      await menuItem.save();
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

const ScanMess = async (req, res) => {
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

    // Check for closure BEFORE scanning
    const closureRecord = await MessClosure.findOne({
      hostelId: messInfo.hostelId,
      closureDate: new Date(currentDate),
    }).lean();
    if (closureRecord) {
      return res.status(400).json({
        message: "Scan failed: Mess is closed today.",
        success: false,
      });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
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
      type: { $in: ["Breakfast", "Lunch", "Dinner"] }
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
      const { publishMessScan } = require("../../utils/scanBroadcast.js");
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

const getUnassignedMess = async (req, res) => {
  try {
    const unassignedMesses = await Mess.find({ hostelId: null });
    res.status(200).json(unassignedMesses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const assignMessToHostel = async (req, res) => {
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

const changeHostel = async (req, res) => {
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

const unassignMess = async (req, res) => {
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

module.exports = {
  createMess,
  createMessWithoutHostel,
  createMenu,
  deleteMenu,
  createMenuItem,
  deleteMenuItem,
  getUserMessInfo,
  getAllMessInfo,
  getMessInfo,
  getMessMenuByDay,
  getMessMenuByDayForAdminHAB,
  getMessMenuItemById,
  toggleLikeMenuItem,
  ScanMess,
  getUnassignedMess,
  assignMessToHostel,
  unassignMess,
  changeHostel,
};
