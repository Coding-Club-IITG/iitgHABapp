const { MessClosure } = require("./messClosureModel.js");
const { Hostel } = require("./hostelModel.js");
const { sendNotificationMessage } = require("../notification/notificationController.js");
const {
  scheduleReminderNotification,
  cancelReminderNotification,
  formatDateToIST,
  formatTimeToIST,
} = require("./messClosureScheduler.js");

/**
 * Helper: Format ISO date string to IST display format
 * @param {string|Date} dateString - ISO date string or Date object
 * @returns {string} - Formatted date in IST
 */
const formatDateForDisplay = (dateString) => {
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    return formatDateToIST(date);
  } catch (error) {
    console.error("Error formatting date for display:", error.message);
    return "Invalid Date";
  }
};

/**
 * Helper function to validate closure date
 * Checks if the date is in the future and has at least 48 hours notice
 */
const validateClosureDate = (closureDate) => {
  const now = new Date();
  const closure = new Date(closureDate);

  if (closure <= now) {
    return { valid: false, message: "Closure date must be in the future" };
  }

  const hoursUntilClosure = (closure - now) / (1000 * 60 * 60);
  if (hoursUntilClosure < 48) {
    return {
      valid: false,
      message: "Minimum 48 hours advance notice required",
    };
  }

  return { valid: true };
};

/**
 * Helper function to check if deletion is allowed
 * Deletion only allowed within 8 hours of creation
 */
const isDeletionAllowed = (createdAt) => {
  const now = new Date();
  const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
  return hoursSinceCreation <= 8;
};

/**
 * Helper function to detect concurrent edits
 * Returns true if closure has been modified since being fetched
 */
const isConcurrentEditDetected = (originalUpdatedAt, currentUpdatedAt) => {
  return originalUpdatedAt.getTime() !== currentUpdatedAt.getTime();
};

/**
 * Helper function to validate month and year
 */
const validateMonthYear = (month, year) => {
  const parsedMonth = parseInt(month);
  const parsedYear = parseInt(year);

  if (isNaN(parsedMonth) || isNaN(parsedYear)) {
    return { valid: false, message: "Month and year must be valid numbers" };
  }

  if (parsedMonth < 1 || parsedMonth > 12) {
    return { valid: false, message: "Month must be between 1 and 12" };
  }

  const currentYear = new Date().getFullYear();
  if (parsedYear < currentYear - 1 || parsedYear > currentYear + 2) {
    return {
      valid: false,
      message: `Year must be within reasonable range (${currentYear - 1}-${currentYear + 2})`,
    };
  }

  return { valid: true, month: parsedMonth, year: parsedYear };
};

/**
 * POST /api/v1/hostel/mess-closure/schedule
 * Schedule a mess closure (HAB Admin)
 */
const scheduleMessClosure = async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(
    `[MessClosure:schedule] Request ${requestId} started for hostel ${req.body.hostelId}`
  );

  try {
    const { hostelId, closureDate } = req.body;
    const adminId = req.hostel._id;

    // Validate closureDate
    if (!closureDate) {
      return res.status(400).json({ message: "Closure date is required" });
    }

    const dateValidation = validateClosureDate(closureDate);
    if (!dateValidation.valid) {
      console.warn(
        `[MessClosure:schedule] Request ${requestId}: ${dateValidation.message}`
      );
      return res.status(400).json({ message: dateValidation.message });
    }

    // Check if hostel exists
    const hostel = await Hostel.findById(hostelId).catch((error) => {
      console.error(
        `[MessClosure:schedule] Request ${requestId}: Database error fetching hostel:`,
        error.message
      );
      return null;
    });

    if (!hostel) {
      console.warn(
        `[MessClosure:schedule] Request ${requestId}: Hostel ${hostelId} not found`
      );
      return res.status(404).json({ message: "Hostel not found" });
    }

    // Parse closure date to get month and year
    const closureDateObj = new Date(closureDate);
    const month = closureDateObj.getMonth() + 1;
    const year = closureDateObj.getFullYear();

    // Check if closure already exists for this hostel in this month
    const existingClosure = await MessClosure.findOne({
      hostelId,
      month,
      year,
    }).catch((error) => {
      console.error(
        `[MessClosure:schedule] Request ${requestId}: Database error checking existing closure:`,
        error.message
      );
      throw error;
    });

    if (existingClosure) {
      console.warn(
        `[MessClosure:schedule] Request ${requestId}: Already exists closure for hostel ${hostelId} in month ${month}/${year}`
      );
      return res.status(400).json({
        message: "Only one closure per hostel per month allowed",
      });
    }

    // Create new closure record
    const closure = await MessClosure.create({
      hostelId,
      closureDate,
      month,
      year,
      finalizedAt: new Date(),
      scheduledBy: adminId,
      notificationSent: false,
      reminderScheduled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).catch((error) => {
      console.error(
        `[MessClosure:schedule] Request ${requestId}: Database error creating closure:`,
        error.message
      );
      throw error;
    });

    console.log(
      `[MessClosure:schedule] Request ${requestId}: Created closure ${closure._id}`
    );

    // Send immediate notification
    const hostelName = hostel.hostel_name;
    const notificationTopic = `Subscribers_${hostelName}`;
    const formattedDate = formatDateForDisplay(closureDateObj);

    let notificationSent = false;
    try {
      await sendNotificationMessage(
        "Mess Closure Notice",
        `Mess will be closed on ${formattedDate}`,
        notificationTopic,
        { closureId: closure._id.toString(), hostelId: hostelId.toString() },
        false
      );

      // Update notification sent flag
      closure.notificationSent = true;
      await closure.save();
      notificationSent = true;

      console.log(
        `[MessClosure:schedule] Request ${requestId}: Notification sent for closure ${closure._id}`
      );
    } catch (notifError) {
      console.error(
        `[MessClosure:schedule] Request ${requestId}: Notification send failed:`,
        notifError.message,
        "- Continuing with closure creation"
      );
      // Continue even if notification fails
    }

    // Schedule 1-day-before reminder
    let reminderScheduled = false;
    try {
      await scheduleReminderNotification(closure);
      reminderScheduled = true;
      console.log(
        `[MessClosure:schedule] Request ${requestId}: Reminder scheduled for closure ${closure._id}`
      );
    } catch (scheduleError) {
      console.error(
        `[MessClosure:schedule] Request ${requestId}: Reminder scheduling failed:`,
        scheduleError.message,
        "- Continuing with closure creation"
      );
      // Continue even if scheduling fails
    }

    console.log(
      `[MessClosure:schedule] Request ${requestId}: Completed successfully`
    );

    return res.status(201).json({
      message: "Mess closure scheduled successfully",
      closure: closure,
      metadata: { notificationSent, reminderScheduled },
    });
  } catch (err) {
    console.error(
      `[MessClosure:schedule] Request ${requestId}: Unexpected error:`,
      err.message
    );
    return res
      .status(500)
      .json({ message: "Error occurred", error: err.message });
  }
};

/**
 * GET /api/v1/hostel/mess-closure/all
 * Get all mess closures (HAB Admin) with optional filters
 */
const getAllMessClosures = async (req, res) => {
  try {
    const { hostelId, month, year, upcoming } = req.query;
    let filter = {};

    // Validate optional month/year parameters
    if (month || year) {
      if (!month || !year) {
        return res.status(400).json({
          message: "Both month and year must be provided together",
        });
      }

      const validation = validateMonthYear(month, year);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      filter.month = validation.month;
      filter.year = validation.year;
    }

    if (hostelId) {
      filter.hostelId = hostelId;
    }

    if (upcoming === "true") {
      filter.closureDate = { $gte: new Date() };
    }

    const closures = await MessClosure.find(filter)
      .populate("hostelId", "hostel_name")
      .populate("scheduledBy", "name email")
      .sort({ closureDate: 1 })
      .catch((error) => {
        console.error(
          "[MessClosure:getAllMessClosures] Database error:",
          error.message
        );
        throw error;
      });

    console.log(
      `[MessClosure:getAllMessClosures] Retrieved ${closures.length} closures with filter: ${JSON.stringify(filter)}`
    );

    return res.status(200).json(closures);
  } catch (err) {
    console.error("[MessClosure:getAllMessClosures] Error:", err.message);
    return res
      .status(500)
      .json({ message: "Error occurred", error: err.message });
  }
};

/**
 * PUT /api/v1/hostel/mess-closure/:id
 * Update a mess closure (HAB Admin)
 */
const updateMessClosure = async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const closureId = req.params.id;
  console.log(`[MessClosure:update] Request ${requestId} started for closure ${closureId}`);

  try {
    const { closureDate, lastModified } = req.body;

    if (!closureDate) {
      return res.status(400).json({ message: "Closure date is required" });
    }

    // Find the closure
    const closure = await MessClosure.findById(closureId).catch((error) => {
      console.error(
        `[MessClosure:update] Request ${requestId}: Database error fetching closure:`,
        error.message
      );
      throw error;
    });

    if (!closure) {
      console.warn(
        `[MessClosure:update] Request ${requestId}: Closure ${closureId} not found`
      );
      return res.status(404).json({ message: "Closure not found" });
    }

    // Check for concurrent edits (simple version comparison)
    if (lastModified) {
      const lastModifiedTime = new Date(lastModified).getTime();
      const currentModifiedTime = closure.updatedAt.getTime();
      if (lastModifiedTime !== currentModifiedTime) {
        console.warn(
          `[MessClosure:update] Request ${requestId}: Concurrent edit detected for closure ${closureId}`
        );
        return res.status(409).json({
          message:
            "Closure was modified by another user. Please refresh and try again.",
          currentClosure: closure,
        });
      }
    }

    // Check if update is within 8 hours of creation
    if (!isDeletionAllowed(closure.createdAt)) {
      console.warn(
        `[MessClosure:update] Request ${requestId}: Update not allowed - closure ${closureId} is older than 8 hours`
      );
      return res.status(400).json({
        message:
          "Closure can only be updated within 8 hours of creation (now requires deletion and rescheduling)",
      });
    }

    // Validate new closure date
    const dateValidation = validateClosureDate(closureDate);
    if (!dateValidation.valid) {
      console.warn(
        `[MessClosure:update] Request ${requestId}: ${dateValidation.message}`
      );
      return res.status(400).json({ message: dateValidation.message });
    }

    const oldClosureDate = formatDateForDisplay(closure.closureDate);

    // Cancel old reminder
    if (closure.reminderScheduled) {
      try {
        await cancelReminderNotification(closure._id);
        console.log(
          `[MessClosure:update] Request ${requestId}: Old reminder cancelled for closure ${closureId}`
        );
      } catch (err) {
        console.error(
          `[MessClosure:update] Request ${requestId}: Error canceling old reminder:`,
          err.message
        );
        // Continue even if reminder cancellation fails
      }
    }

    // Update closure record
    const closureDateObj = new Date(closureDate);
    closure.closureDate = closureDateObj;
    closure.month = closureDateObj.getMonth() + 1;
    closure.year = closureDateObj.getFullYear();
    closure.reminderScheduled = false;
    closure.updatedAt = new Date();

    await closure.save().catch((error) => {
      console.error(
        `[MessClosure:update] Request ${requestId}: Database error saving closure:`,
        error.message
      );
      throw error;
    });

    console.log(
      `[MessClosure:update] Request ${requestId}: Closure ${closureId} updated`
    );

    // Send update notification
    const hostel = await Hostel.findById(closure.hostelId).catch((error) => {
      console.error(
        `[MessClosure:update] Request ${requestId}: Database error fetching hostel:`,
        error.message
      );
      return null;
    });

    if (hostel) {
      const hostelName = hostel.hostel_name;
      const notificationTopic = `Subscribers_${hostelName}`;
      const newFormattedDate = formatDateForDisplay(closureDateObj);

      try {
        await sendNotificationMessage(
          "Mess Closure Updated",
          `Mess closure date has been updated to ${newFormattedDate} (was: ${oldClosureDate})`,
          notificationTopic,
          {
            closureId: closure._id.toString(),
            hostelId: closure.hostelId.toString(),
          },
          false
        );
        console.log(
          `[MessClosure:update] Request ${requestId}: Update notification sent`
        );
      } catch (notifError) {
        console.error(
          `[MessClosure:update] Request ${requestId}: Update notification send failed:`,
          notifError.message
        );
        // Continue even if notification fails
      }
    }

    // Schedule new reminder
    try {
      await scheduleReminderNotification(closure);
      console.log(
        `[MessClosure:update] Request ${requestId}: New reminder scheduled`
      );
    } catch (scheduleError) {
      console.error(
        `[MessClosure:update] Request ${requestId}: New reminder scheduling failed:`,
        scheduleError.message
      );
      // Continue even if scheduling fails
    }

    console.log(
      `[MessClosure:update] Request ${requestId}: Completed successfully`
    );

    return res.status(200).json({
      message: "Mess closure updated successfully",
      closure: closure,
    });
  } catch (err) {
    console.error(
      `[MessClosure:update] Request ${requestId}: Unexpected error:`,
      err.message
    );
    return res
      .status(500)
      .json({ message: "Error occurred", error: err.message });
  }
};

/**
 * DELETE /api/v1/hostel/mess-closure/:id
 * Delete a mess closure (HAB Admin)
 */
const deleteMessClosure = async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const closureId = req.params.id;
  console.log(`[MessClosure:delete] Request ${requestId} started for closure ${closureId}`);

  try {
    const closure = await MessClosure.findById(closureId).catch((error) => {
      console.error(
        `[MessClosure:delete] Request ${requestId}: Database error fetching closure:`,
        error.message
      );
      throw error;
    });

    if (!closure) {
      console.warn(
        `[MessClosure:delete] Request ${requestId}: Closure ${closureId} not found`
      );
      return res.status(404).json({ message: "Closure not found" });
    }

    // Check if deletion is allowed (within 8 hours of creation)
    if (!isDeletionAllowed(closure.createdAt)) {
      console.warn(
        `[MessClosure:delete] Request ${requestId}: Deletion not allowed - closure ${closureId} is older than 8 hours`
      );
      return res.status(400).json({
        message: "Closure can only be deleted within 8 hours of creation",
      });
    }

    const closureDate = formatDateForDisplay(closure.closureDate);
    const hostelId = closure.hostelId.toString();

    // Cancel reminder notification if scheduled
    if (closure.reminderScheduled) {
      try {
        await cancelReminderNotification(closure._id);
        console.log(
          `[MessClosure:delete] Request ${requestId}: Reminder cancelled for closure ${closureId}`
        );
      } catch (err) {
        console.error(
          `[MessClosure:delete] Request ${requestId}: Error canceling reminder:`,
          err.message
        );
        // Continue even if reminder cancellation fails
      }
    }

    // Delete the closure record
    await MessClosure.findByIdAndDelete(closureId).catch((error) => {
      console.error(
        `[MessClosure:delete] Request ${requestId}: Database error deleting closure:`,
        error.message
      );
      throw error;
    });

    console.log(
      `[MessClosure:delete] Request ${requestId}: Closure ${closureId} deleted`
    );

    // Send cancellation notification
    const hostel = await Hostel.findById(hostelId).catch((error) => {
      console.error(
        `[MessClosure:delete] Request ${requestId}: Database error fetching hostel:`,
        error.message
      );
      return null;
    });

    if (hostel) {
      const hostelName = hostel.hostel_name;
      const notificationTopic = `Subscribers_${hostelName}`;

      try {
        await sendNotificationMessage(
          "Mess Closure Cancelled",
          `Mess closure scheduled for ${closureDate} has been cancelled`,
          notificationTopic,
          { hostelId: hostelId },
          false
        );
        console.log(
          `[MessClosure:delete] Request ${requestId}: Cancellation notification sent`
        );
      } catch (notifError) {
        console.error(
          `[MessClosure:delete] Request ${requestId}: Cancellation notification send failed:`,
          notifError.message
        );
        // Continue even if notification fails
      }
    }

    console.log(
      `[MessClosure:delete] Request ${requestId}: Completed successfully`
    );

    return res.status(200).json({ message: "Mess closure deleted successfully" });
  } catch (err) {
    console.error(
      `[MessClosure:delete] Request ${requestId}: Unexpected error:`,
      err.message
    );
    return res
      .status(500)
      .json({ message: "Error occurred", error: err.message });
  }
};

/**
 * GET /api/v1/hostel/mess-closure
 * Get mess closures for authenticated hostel (Hostel Admin)
 */
const getHostelMessClosures = async (req, res) => {
  try {
    const hostelId = req.hostel._id;
    const { month, year } = req.query;

    let filter = { hostelId };

    // Validate optional month/year parameters
    if (month || year) {
      if (!month || !year) {
        return res.status(400).json({
          message: "Both month and year must be provided together",
        });
      }

      const validation = validateMonthYear(month, year);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      filter.month = validation.month;
      filter.year = validation.year;
    }

    const closures = await MessClosure.find(filter)
      .populate("scheduledBy", "name email")
      .sort({ closureDate: 1 })
      .catch((error) => {
        console.error(
          `[MessClosure:getHostelMessClosures] Database error for hostel ${hostelId}:`,
          error.message
        );
        throw error;
      });

    console.log(
      `[MessClosure:getHostelMessClosures] Retrieved ${closures.length} closures for hostel ${hostelId}`
    );

    return res.status(200).json(closures);
  } catch (err) {
    console.error("[MessClosure:getHostelMessClosures] Error:", err.message);
    return res
      .status(500)
      .json({ message: "Error occurred", error: err.message });
  }
};

/**
 * GET /api/v1/hostel/mess-closure/upcoming
 * Get next upcoming mess closure for authenticated hostel (Hostel Admin)
 */
const getUpcomingHostelMessClosure = async (req, res) => {
  try {
    const hostelId = req.hostel._id;

    const upcomingClosure = await MessClosure.findOne({
      hostelId,
      closureDate: { $gte: new Date() },
    })
      .populate("scheduledBy", "name email")
      .sort({ closureDate: 1 })
      .catch((error) => {
        console.error(
          `[MessClosure:getUpcomingHostelMessClosure] Database error for hostel ${hostelId}:`,
          error.message
        );
        throw error;
      });

    if (!upcomingClosure) {
      console.log(
        `[MessClosure:getUpcomingHostelMessClosure] No upcoming closure for hostel ${hostelId}`
      );
      return res.status(200).json({ closure: null });
    }

    console.log(
      `[MessClosure:getUpcomingHostelMessClosure] Found upcoming closure for hostel ${hostelId}: ${formatDateForDisplay(upcomingClosure.closureDate)}`
    );

    return res.status(200).json({ closure: upcomingClosure });
  } catch (err) {
    console.error("[MessClosure:getUpcomingHostelMessClosure] Error:", err.message);
    return res
      .status(500)
      .json({ message: "Error occurred", error: err.message });
  }
};

/**
 * GET /api/v1/hostel/mess-closure/days-count
 * Get mess closure days count for bill calculation (Hostel Admin)
 * Handles month boundaries correctly
 */
const getMessClosureDaysCount = async (req, res) => {
  try {
    const hostelId = req.hostel._id;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        message: "Month and year are required query parameters",
      });
    }

    const validation = validateMonthYear(month, year);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const parsedMonth = validation.month;
    const parsedYear = validation.year;

    // Get total days in month (handles all edge cases including leap years)
    // Using: new Date(year, month, 0).getDate() gets the last day of previous month
    // So new Date(year, month, 0) where month is 1-indexed gives us last day of the target month
    const lastDay = new Date(parsedYear, parsedMonth, 0).getDate();

    if (lastDay < 28 || lastDay > 31) {
      console.error(
        `[MessClosure:getMessClosureDaysCount] Invalid days calculation for ${parsedMonth}/${parsedYear}: ${lastDay}`
      );
      return res.status(500).json({
        message: "Error calculating days in month",
      });
    }

    // Query for closures in this month/year for this hostel
    const closures = await MessClosure.find({
      hostelId,
      month: parsedMonth,
      year: parsedYear,
    }).catch((error) => {
      console.error(
        `[MessClosure:getMessClosureDaysCount] Database error for hostel ${hostelId}:`,
        error.message
      );
      throw error;
    });

    // Count closure days
    const closureDays = closures.length;

    // Validate closure days (should be 0 or 1 due to unique constraint)
    if (closureDays > 1) {
      console.warn(
        `[MessClosure:getMessClosureDaysCount] Unexpected multiple closures (${closureDays}) for hostel ${hostelId} in ${parsedMonth}/${parsedYear}`
      );
    }

    // Calculate operating days
    const operatingDays = lastDay - closureDays;

    console.log(
      `[MessClosure:getMessClosureDaysCount] Calculated for hostel ${hostelId} ${parsedMonth}/${parsedYear}: total=${lastDay}, closures=${closureDays}, operating=${operatingDays}`
    );

    return res.status(200).json({
      closureDays,
      totalDaysInMonth: lastDay,
      operatingDays,
    });
  } catch (err) {
    console.error("[MessClosure:getMessClosureDaysCount] Error:", err.message);
    return res
      .status(500)
      .json({ message: "Error occurred", error: err.message });
  }
};

module.exports = {
  scheduleMessClosure,
  getAllMessClosures,
  updateMessClosure,
  deleteMessClosure,
  getHostelMessClosures,
  getUpcomingHostelMessClosure,
  getMessClosureDaysCount,
};
