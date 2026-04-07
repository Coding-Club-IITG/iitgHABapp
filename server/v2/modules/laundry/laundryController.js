const { User } = require("../user/userModel.js");
const { Hostel } = require("../hostel/hostelModel.js");
const { LaundryBooking } = require("./laundryBookingModel.js");

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * GET /api/laundry/status
 * Returns laundry eligibility, last used, next available, and recent bookings.
 * Single call for the laundry page to minimize API usage.
 */
const getStatus = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.hostel) {
      return res.status(200).json({
        canUse: false,
        lastUsed: null,
        nextAvailable: null,
        hostelHasLaundry: false,
        message: "No hostel assigned",
        recentBookings: [],
      });
    }

    const hostel = await Hostel.findById(user.hostel).lean();
    const hostelHasLaundry = hostel?.isLaundryAvailable === true;

    const lastUsed = user.lastLaundryUsed
      ? new Date(user.lastLaundryUsed)
      : null;
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - TWO_WEEKS_MS);
    const canUse =
      hostelHasLaundry &&
      (lastUsed === null || lastUsed.getTime() <= twoWeeksAgo.getTime());

    let nextAvailable = null;
    if (hostelHasLaundry && lastUsed) {
      nextAvailable = new Date(lastUsed.getTime() + TWO_WEEKS_MS);
      if (nextAvailable.getTime() <= now.getTime()) nextAvailable = null;
    }

    const recentBookings = await LaundryBooking.find({ userId: user._id })
      .sort({ usedAt: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      canUse,
      lastUsed: lastUsed ? lastUsed.toISOString() : null,
      nextAvailable: nextAvailable ? nextAvailable.toISOString() : null,
      hostelHasLaundry,
      recentBookings: recentBookings.map((b) => ({
        _id: b._id,
        usedAt: b.usedAt,
      })),
    });
  } catch (err) {
    console.error("laundry getStatus error:", err);
    return res.status(500).json({ message: "Error fetching laundry status" });
  }
};

/**
 * POST /api/laundry/scan
 * Body: { hostelId: string } or { scannedPayload: string } (hostelId preferred).
 * Validates 1 free laundry every 2 weeks, creates booking, updates user.lastLaundryUsed.
 */
const scan = async (req, res) => {
  try {
    const user = req.user;
    const { hostelId, scannedPayload } = req.body || {};

    if (!user || !user.hostel) {
      return res.status(400).json({
        message: "No hostel assigned. You cannot use laundry service.",
      });
    }

    const userHostelId = user.hostel.toString();
    const targetHostelId = hostelId || (scannedPayload && scannedPayload.trim()) || userHostelId;
    // If scanned payload is an object ID, use it; else use user's hostel
    const hostelIdToUse = targetHostelId.length === 24 && /^[a-f0-9]{24}$/i.test(targetHostelId)
      ? targetHostelId
      : userHostelId;

    if (hostelIdToUse !== userHostelId) {
      return res.status(403).json({
        message: "You can only use laundry service at your own hostel.",
      });
    }

    const hostel = await Hostel.findById(hostelIdToUse).lean();
    if (!hostel || !hostel.isLaundryAvailable) {
      return res.status(400).json({
        message: "Laundry service is not available for your hostel.",
      });
    }

    const lastUsed = user.lastLaundryUsed
      ? new Date(user.lastLaundryUsed)
      : null;
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - TWO_WEEKS_MS);

    if (lastUsed && lastUsed.getTime() > twoWeeksAgo.getTime()) {
      const nextAvailable = new Date(lastUsed.getTime() + TWO_WEEKS_MS);
      return res.status(400).json({
        message: "You can use 1 free laundry every 2 weeks. Next available after 2 weeks from last use.",
        nextAvailable: nextAvailable.toISOString(),
      });
    }

    const fullUser = await User.findById(user._id);
    if (!fullUser) {
      return res.status(500).json({ message: "User not found" });
    }

    const booking = await LaundryBooking.create({
      userId: fullUser._id,
      usedAt: now,
    });

    fullUser.lastLaundryUsed = now;
    await fullUser.save();

    return res.status(200).json({
      message: "Laundry service availed successfully.",
      booking: {
        _id: booking._id,
        usedAt: booking.usedAt,
      },
    });
  } catch (err) {
    console.error("laundry scan error:", err);
    return res.status(500).json({ message: "Error processing laundry scan" });
  }
};

/**
 * GET /api/laundry/hostel/dashboard
 * For hostel office portal. Requires hostel JWT (authenticateAdminJWT).
 * Returns QR payload, isLaundryAvailable, stats (total + by date), and recent logs.
 */
const getHostelDashboard = async (req, res) => {
  try {
    const hostel = req.hostel;
    if (!hostel) {
      return res.status(403).json({ message: "Hostel authentication required" });
    }

    const hostelId = hostel._id.toString();
    const isLaundryAvailable = hostel.isLaundryAvailable === true;

    const userIds = await User.find({ hostel: hostel._id }).select("_id").lean();
    const ids = userIds.map((u) => u._id);

    const byMonth = await LaundryBooking.aggregate([
      { $match: { userId: { $in: ids } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$usedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    const logs = await LaundryBooking.find({ userId: { $in: ids } })
      .sort({ usedAt: -1 })
      .limit(100)
      .populate("userId", "name rollNumber")
      .lean();

    return res.status(200).json({
      hostelId,
      qrPayload: hostelId,
      isLaundryAvailable,
      stats: {
        byMonth: byMonth.map((d) => ({
          yearMonth: d._id,
          year: parseInt(d._id.slice(0, 4), 10),
          month: parseInt(d._id.slice(5, 7), 10),
          count: d.count,
        })),
      },
      logs: logs.map((b) => ({
        _id: b._id,
        usedAt: b.usedAt,
        userName: b.userId?.name ?? "—",
        rollNumber: b.userId?.rollNumber ?? "—",
      })),
    });
  } catch (err) {
    console.error("laundry getHostelDashboard error:", err);
    return res.status(500).json({ message: "Error fetching laundry dashboard" });
  }
};

module.exports = {
  getStatus,
  scan,
  getHostelDashboard,
};
