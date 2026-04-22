import mongoose from "mongoose";

import { Menu } from "./menuModel.js";
import { MenuItem } from "./menuItemModel.js";

import redisClient from "../../utils/redisClient.js";
import { sortMenuItemsByMenuOrder } from "../../utils/sortMenuItemsByMenuOrder.js";

export const getMessMenuByDayForAdmin = async (req, res) => {
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
      const menu = await Menu.find({ messId: messId, day: day }).sort({
        startTime: 1,
      });
      if (!menu || menu.length === 0) {
        return res.status(200).json("DoesntExist");
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

    const specificMenus = populatedMenus.map((m) => {
      const mClone = { ...m };
      mClone.items = m.items.map((item) => {
        return {
          ...item,
          likesCount: item.likes ? item.likes.length : 0,
          likes: undefined,
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

// modify menu item
export const modifyMenuItem = async (req, res) => {
  try {
    const _Id = req.body._Id;
    const name = req.body.name;

    // const hostelId = req.user.id; //use hostelID

    const menuItem = await MenuItem.findById(_Id);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    menuItem.name = name || menuItem.name;

    await menuItem.save();
    const menu = await Menu.findOne({ items: _Id });
    if (menu) {
      await redisClient.del(`menu_${menu.messId}_${menu.day}`);
    }

    return res
      .status(200)
      .json({ message: "Menu item updated successfully", menuItem });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateTime = async (req, res) => {
  try {
    // Accept messId either in body or as a URL param (for SMC variant)
    const messId = req.body.messId || req.params?.messId;
    const type = req.body.type; // expected: 'Breakfast' | 'Lunch' | 'Dinner'
    const day = req.body.day;

    if (!messId || !day || !type) {
      return res
        .status(400)
        .json({ message: "messId, day and type are required" });
    }

    let start;
    let end;

    if (type === "Breakfast") {
      start = req.body.btime_s;
      end = req.body.btime_e;
    } else if (type === "Lunch") {
      start = req.body.ltime_s;
      end = req.body.ltime_e;
    } else if (type === "Dinner") {
      start = req.body.dtime_s;
      end = req.body.dtime_e;
    } else {
      return res.status(400).json({ message: "Invalid meal type" });
    }

    // Find the specific Menu document for this messId, day and meal type
    const menu = await Menu.findOne({ messId: messId, day: day, type: type });
    if (!menu) {
      return res
        .status(404)
        .json({ message: "Menu not found for this meal/day" });
    }

    menu.startTime = start;
    menu.endTime = end;

    await menu.save();
    await redisClient.del(`menu_${messId}_${day}`);

    return res
      .status(200)
      .json({ message: "Menu timing updated successfully", menu });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// SMC-specific time update: allow authenticated SMC users to update timings
export const updateTimeSMC = async (req, res) => {
  try {
    const user = req.user;
    const isAuthorized = (user && user.isSMC) || !!req.hostel;
    if (!isAuthorized) {
      return res
        .status(403)
        .json({ message: "Unauthorized: User is not an SMC member" });
    }

    // Delegate to same logic as updateTime by reusing request shape.
    // We can call updateTime directly, but to keep separation we duplicate minimal logic.
    const messId = req.params?.messId || req.body.messId;
    const type = req.body.type;
    const day = req.body.day;

    if (!messId || !day || !type) {
      return res
        .status(400)
        .json({ message: "messId, day and type are required" });
    }

    let start;
    let end;

    if (type === "Breakfast") {
      start = req.body.btime_s;
      end = req.body.btime_e;
    } else if (type === "Lunch") {
      start = req.body.ltime_s;
      end = req.body.ltime_e;
    } else if (type === "Dinner") {
      start = req.body.dtime_s;
      end = req.body.dtime_e;
    } else {
      return res.status(400).json({ message: "Invalid meal type" });
    }

    const menu = await Menu.findOne({ messId: messId, day: day, type: type });
    if (!menu) {
      return res
        .status(404)
        .json({ message: "Menu not found for this meal/day" });
    }

    menu.startTime = start;
    menu.endTime = end;
    await menu.save();
    await redisClient.del(`menu_${messId}_${day}`);

    return res
      .status(200)
      .json({ message: "Menu timing updated successfully (SMC)", menu });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// SMC-specific version that uses user authentication
export const getMessMenuByDayForSMC = async (req, res) => {
  try {
    const messId = req.params.messId;
    const day = req.body.day;
    const user = req.user; // From authenticateJWT

    if (!messId || !day) {
      return res.status(400).json({ message: "Mess ID and day are required" });
    }

    // Verify user is SMC
    const isAuthorized = (user && user.isSMC) || !!req.hostel;
    if (!isAuthorized) {
      return res.status(403).json({
        message: "Unauthorized: User is not an SMC member",
      });
    }

    const cacheKey = `menu_${messId}_${day}`;
    let populatedMenus = await redisClient.get(cacheKey);
    if (populatedMenus) populatedMenus = JSON.parse(populatedMenus);

    if (!populatedMenus) {
      const menu = await Menu.find({ messId: messId, day: day }).sort({
        startTime: 1,
      });
      if (!menu || menu.length === 0) {
        return res.status(200).json("DoesntExist");
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

    const specificMenus = populatedMenus.map((m) => {
      const mClone = { ...m };
      mClone.items = m.items.map((item) => {
        return {
          ...item,
          likesCount: item.likes ? item.likes.length : 0,
          likes: undefined,
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

// SMC version of modifyMenuItem
export const modifyMenuItemSMC = async (req, res) => {
  try {
    const _Id = req.body._Id;
    const name = req.body.name;
    const user = req.user; // From authenticateJWT

    // Verify user is SMC
    const isAuthorized = (user && user.isSMC) || !!req.hostel;
    if (!isAuthorized) {
      return res.status(403).json({
        message: "Unauthorized: User is not an SMC member",
      });
    }

    const menuItem = await MenuItem.findById(_Id);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    menuItem.name = name || menuItem.name;

    await menuItem.save();
    const menu = await Menu.findOne({ items: _Id });
    if (menu) {
      await redisClient.del(`menu_${menu.messId}_${menu.day}`);
    }

    return res
      .status(200)
      .json({ message: "Menu item updated successfully", menuItem });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** SMC: persist `Menu.items` order (same sequence the mobile app lists). */
export const reorderMenuItemsSMC = async (req, res) => {
  try {
    const messId = req.params.messId;
    const { day, type, itemIds } = req.body;
    const user = req.user;
    const isAuthorized = (user && user.isSMC) || !!req.hostel;
    if (!isAuthorized) {
      return res.status(403).json({
        message: "Unauthorized: User is not an SMC member",
      });
    }

    if (!messId || !day || !type || !Array.isArray(itemIds)) {
      return res.status(400).json({
        message: "messId, day, type, and itemIds[] are required",
      });
    }
    if (!["Breakfast", "Lunch", "Dinner"].includes(type)) {
      return res.status(400).json({ message: "Invalid meal type" });
    }

    for (const id of itemIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid item id" });
      }
    }

    const menu = await Menu.findOne({ messId, day, type });
    if (!menu) {
      return res
        .status(404)
        .json({ message: "Menu not found for this meal/day" });
    }

    // Same multiset + order semantics as GET menu: hydrate by `menu.items` refs,
    // not `MenuItem.menuId`. Items can appear in the list while `menuId` points
    // elsewhere; the old `menuId` check caused 400 even when the UI matched DB.
    const menuItemsOrder = menu.items;
    const menuItemDetails = await MenuItem.find({
      _id: { $in: menuItemsOrder },
    }).lean();
    const sortedVisible = sortMenuItemsByMenuOrder(
      menuItemsOrder,
      menuItemDetails,
    );
    const canonicalIds = sortedVisible.map((d) => d._id.toString());

    if (itemIds.length !== canonicalIds.length) {
      return res.status(400).json({
        message: "itemIds must list each menu item exactly once",
      });
    }
    if (new Set(itemIds.map(String)).size !== itemIds.length) {
      return res.status(400).json({ message: "Duplicate item id in itemIds" });
    }

    const sortedIncoming = [...itemIds].map(String).sort();
    const sortedCanon = [...canonicalIds].map(String).sort();
    if (
      sortedIncoming.length !== sortedCanon.length ||
      !sortedIncoming.every((v, i) => v === sortedCanon[i])
    ) {
      return res.status(400).json({
        message: "itemIds must match the current menu items",
      });
    }

    menu.items = itemIds.map((id) => new mongoose.Types.ObjectId(id));
    await menu.save();
    await redisClient.del(`menu_${messId}_${day}`);

    return res.status(200).json({ message: "Menu order updated", menu });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
