import { logger } from "../../logging/logger.js";
import mongoose from "mongoose";
import { MessShutdown } from "./messShutdownModel.js";

function parseIsoDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function asDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function ensureObjectId(id) {
  if (!id) return null;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export const createMessShutdown = async (req, res) => {
  try {
    const { hostelId, type } = req.body || {};

    const hostelObjId = ensureObjectId(hostelId);
    if (!hostelObjId) {
      return res.status(400).json({ message: "Valid hostelId is required" });
    }

    if (type !== "SINGLE_DAY" && type !== "RANGE") {
      return res
        .status(400)
        .json({ message: 'type must be "SINGLE_DAY" or "RANGE"' });
    }

    let startDate;
    let endDate;

    if (type === "SINGLE_DAY") {
      const date = parseIsoDateOnly(req.body?.date);
      if (!date) {
        return res
          .status(400)
          .json({ message: "date (YYYY-MM-DD) is required for SINGLE_DAY" });
      }
      startDate = asDateOnly(date);
      endDate = asDateOnly(date);
    } else {
      const from = parseIsoDateOnly(req.body?.fromDate);
      const to = parseIsoDateOnly(req.body?.toDate);
      if (!from || !to) {
        return res.status(400).json({
          message: "fromDate and toDate (YYYY-MM-DD) are required for RANGE",
        });
      }
      startDate = asDateOnly(from);
      endDate = asDateOnly(to);
    }

    if (startDate > endDate) {
      return res
        .status(400)
        .json({ message: "startDate must be <= endDate" });
    }

    // Prevent overlapping shutdown ranges for same hostel
    const overlapping = await MessShutdown.findOne({
      hostelId: hostelObjId,
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    }).lean();
    if (overlapping) {
      return res.status(409).json({
        message: "Shutdown overlaps with an existing shutdown for this hostel",
        overlappingShutdownId: overlapping._id,
      });
    }

    const createdBy = req.user?.id ? ensureObjectId(req.user.id) : null;
    const shutdown = await MessShutdown.create({
      hostelId: hostelObjId,
      type,
      startDate,
      endDate,
      createdBy,
    });

    return res.status(201).json(shutdown);
  } catch (error) {
    logger.error("Error creating mess shutdown:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const listMessShutdowns = async (req, res) => {
  try {
    const hostelObjId = ensureObjectId(req.query?.hostelId);
    if (!hostelObjId) {
      return res.status(400).json({ message: "hostelId query param is required" });
    }

    const shutdowns = await MessShutdown.find({ hostelId: hostelObjId })
      .sort({ startDate: -1, endDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({ shutdowns });
  } catch (error) {
    logger.error("Error listing mess shutdowns:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const listMyMessShutdowns = async (req, res) => {
  try {
    const hostelId = req.hostel?._id;
    if (!hostelId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const shutdowns = await MessShutdown.find({ hostelId })
      .sort({ startDate: -1, endDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({ shutdowns });
  } catch (error) {
    logger.error("Error listing hostel mess shutdowns:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const deleteMessShutdown = async (req, res) => {
  try {
    const id = ensureObjectId(req.params?.id);
    if (!id) {
      return res.status(400).json({ message: "Valid shutdown id is required" });
    }

    const deleted = await MessShutdown.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Mess shutdown not found" });
    }

    return res.status(200).json({ message: "Mess shutdown deleted" });
  } catch (error) {
    logger.error("Error deleting mess shutdown:", { error: error });
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

