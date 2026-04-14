import fs from "fs";
import path from "path";
const __dirname = import.meta.dirname;
import axios from "axios";
import multer from "multer";
import mongoose from "mongoose";

import Leave from "./leaveModel.js";
import { User } from "../user/userModel.js";

import { buildStationLeavePdf } from "./stationLeavePdf.js";
import { sendNotificationToUser } from "../notification/notificationController.js";
import {
  downloadFromOnedrive,
  uploadBufferToLeaveFolder,
} from "../../utils/onedriveController.js";

const uploadDir = path.join(__dirname, ".", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//     const timeStamp = Date.now();
//     cb(null, `leave-${req.user?req.user._id:req.hostel._id}-${timeStamp}-${file.originalname}`);
//   },
// });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("UNSUPPORTED_FILE_TYPE"));
    }
  },
});

export const uploadMiddleware = async (req, res, next) => {
  upload.fields([{ name: "proofDocument", maxCount: 1 }])(req, res, (err) => {
    if (err) {
      if (err.message == "UNSUPPORTED_FILE_TYPE") {
        res.status(400).json({
          message: "Invalid file Type. Only jpg, pdf, png are allowed!",
          error: err.message,
        });
        return;
      }
    }
    next();
  });
};

const BILL_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function billMonthNameToNumber(month) {
  if (month == null) return null;
  if (typeof month === "number" && month >= 1 && month <= 12) {
    return month;
  }
  const s = String(month).trim();
  const idx = BILL_MONTH_NAMES.findIndex(
    (m) => m.toLowerCase() === s.toLowerCase(),
  );
  return idx >= 0 ? idx + 1 : null;
}

// Acknowledged applications overlapping the calendar month (used for mess rebate preview)
async function getRebateDaysForMonth(messHostelId, month, year) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  let query = {};

  const leaves = await Leave.find({
    messHostel: messHostelId,
    status: "Acknowledged",
    $or: [{ startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } }],
  })
    .populate("user", "name rollNumber -_id")
    .lean();

  query.totalRebateDays = leaves.reduce(
    (sum, leave) => sum + leave.numberOfDays,
    0,
  );
  query.eligibleApplications = leaves;

  return query;
}

/**
 * After a mess bill is generated for a calendar month, mark overlapping
 * Acknowledged rebate applications as Processed.
 */
export async function markRebateApplicationsProcessedForMessBill(
  messHostelId,
  billMonth,
  billYear,
) {
  const month = billMonthNameToNumber(billMonth);
  const year = Number(billYear);
  if (!month || !Number.isFinite(year)) {
    return { modifiedCount: 0 };
  }
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  const startOfMonth = new Date(year, month - 1, 1);
  const now = new Date();
  return Leave.updateMany(
    {
      messHostel: messHostelId,
      status: "Acknowledged",
      $or: [
        { startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } },
      ],
    },
    { $set: { status: "Processed", processedAt: now } },
  );
}

// Validation of presence of all fields before uploading file to onedrive
export const validateApply = async (req, res, next) => {
  const fields = [
    "leaveType",
    "startDate",
    "endDate",
    "bankAccountNumber",
    "bankIFSCCode",
    "bankName",
    "bankAccountHoldersName",
    "homePermanentAddress",
    "studentDeptLabel",
    "studentProgrammeLabel",
    "stationLeavePurpose",
    "contactDuringLeaveAddress",
    "contactDuringLeavePhone",
    "semesterDisplay",
    "registeredInCurrentSemester",
    "declarationAccepted",
    "roomNumber",
    "phoneNumber",
    "studentName",
    "rollNumber",
    "residentHostel",
    "subscribedMessDisplay",
  ];

  const missingFields = fields.filter((field) => !req.body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Fields cannot be empty",
      emptyFields: missingFields,
    });
  }

  next();
};

function formatDdMmYyyy(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const LOG_FORM_ONLY = "[Leave][generate-form-only]";
const LOG_APPLY = "[Leave][applyForLeave]";

/** Form-only: no Leave row, no bank/proof. Relaxed advance notice; min 1 calendar day inclusive. */
export const validateGenerateFormOnly = async (req, res, next) => {
  const userId = req.user?._id?.toString?.() ?? String(req.user?._id ?? "");
  const bodyKeys =
    req.body && typeof req.body === "object" ? Object.keys(req.body) : [];
  console.log(`${LOG_FORM_ONLY} validate: start`, {
    userId: userId || "(none)",
    bodyKeys,
    hasFile: Boolean(req.file),
    fileFieldname: req.file?.fieldname,
    fileSize: req.file?.size,
  });

  const fields = [
    "startDate",
    "endDate",
    "homePermanentAddress",
    "studentDeptLabel",
    "studentProgrammeLabel",
    "stationLeavePurpose",
    "contactDuringLeaveAddress",
    "contactDuringLeavePhone",
    "semesterDisplay",
    "registeredInCurrentSemester",
    "declarationAccepted",
    "roomNumber",
    "phoneNumber",
    "studentName",
    "rollNumber",
    "residentHostel",
    "subscribedMessDisplay",
  ];
  const missingFields = fields.filter((field) => !req.body[field]);
  if (missingFields.length > 0) {
    console.warn(`${LOG_FORM_ONLY} validate: missing fields`, {
      userId,
      missingFields,
    });
    return res.status(400).json({
      message: "Fields cannot be empty",
      emptyFields: missingFields,
    });
  }
  console.log(`${LOG_FORM_ONLY} validate: ok`, { userId });
  next();
};

export const generateStationLeaveFormOnly = async (req, res) => {
  const userId = req.user?._id?.toString?.() ?? String(req.user?._id ?? "");
  try {
    const {
      startDate,
      endDate,
      homePermanentAddress,
      studentDeptLabel,
      studentProgrammeLabel,
      stationLeavePurpose,
      contactDuringLeaveAddress,
      contactDuringLeavePhone,
      semesterDisplay,
      registeredInCurrentSemester,
      declarationAccepted,
      roomNumber,
      phoneNumber,
      studentName,
      rollNumber,
      residentHostel,
      subscribedMessDisplay,
      email,
    } = req.body;

    console.log(`${LOG_FORM_ONLY} handler: start`, {
      userId,
      startDate,
      endDate,
      declarationAccepted,
      registeredInCurrentSemester,
    });

    const decl =
      declarationAccepted === true ||
      declarationAccepted === "true" ||
      declarationAccepted === "1";
    if (!decl) {
      console.warn(`${LOG_FORM_ONLY} handler: 400 declaration not accepted`, {
        userId,
      });
      return res.status(400).json({
        message: "You must accept the declaration to continue",
      });
    }

    const registeredInCurrSem =
      registeredInCurrentSemester === true ||
      registeredInCurrentSemester === "true" ||
      registeredInCurrentSemester === "1";

    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      console.warn(`${LOG_FORM_ONLY} handler: 400 start before today`, {
        userId,
        startDate,
      });
      return res.status(400).json({
        message: "Start date cannot be before today",
      });
    }
    const latestStartOk = latestRebateStartDateAllowed();
    if (start > latestStartOk) {
      console.warn(`${LOG_FORM_ONLY} handler: 400 start too far ahead`, {
        userId,
        startDate,
      });
      return res.status(400).json({
        message: `Start date cannot be more than ${REBATE_START_MAX_DAYS_AHEAD} days from today`,
      });
    }
    if (end < start) {
      console.warn(`${LOG_FORM_ONLY} handler: 400 invalid range`, {
        userId,
        startDate,
        endDate,
      });
      return res.status(400).json({
        message: "Start, end date combination is invalid",
      });
    }

    const diffBtwDates = Math.abs(end - start);
    const numberOfDays = Math.floor(diffBtwDates / (1000 * 60 * 60 * 24));
    const inclusiveLeaveDays = numberOfDays + 1;
    if (inclusiveLeaveDays < 1) {
      console.warn(`${LOG_FORM_ONLY} handler: 400 invalid duration`, {
        userId,
        inclusiveLeaveDays,
      });
      return res.status(400).json({ message: "Invalid leave duration" });
    }

    if (!(req.user && req.user.curr_subscribed_mess)) {
      if (req.user && !req.user.curr_subscribed_mess) {
        console.warn(`${LOG_FORM_ONLY} handler: 400 no subscribed mess`, {
          userId,
        });
        return res.status(400).json({ message: "Hostel not provided" });
      }
      console.warn(`${LOG_FORM_ONLY} handler: 400 not logged in / no user`, {
        userId,
      });
      return res.status(400).json({ message: "Please login first" });
    }

    const roomForPdf = String(roomNumber ?? "").trim();
    const phoneTrim = String(phoneNumber ?? "").trim();

    const pdfPayload = {
      studentName: String(studentName || "").trim(),
      rollNo: String(rollNumber || "").trim(),
      dept: String(studentDeptLabel || "").trim(),
      programme: String(studentProgrammeLabel || "").trim(),
      semesterLabel: String(semesterDisplay || "").trim(),
      residentHostel: String(residentHostel || "").trim(),
      roomNo: roomForPdf,
      email: String(email ?? "").trim(),
      mobile: phoneTrim,
      registeredCurrentSem: registeredInCurrSem,
      homeAddress: String(homePermanentAddress || "").trim(),
      bankAcName: "Not applicable",
      bankName: "Not applicable",
      bankAcNo: "Not applicable",
      bankIfsc: "Not applicable",
      purpose: String(stationLeavePurpose || "").trim(),
      dateFromStr: formatDdMmYyyy(start),
      dateToStr: formatDdMmYyyy(end),
      totalDays: String(inclusiveLeaveDays),
      leaveTimeStr: "00:01 AM",
      inTimeStr: "11:59 PM",
      subscribedMess: String(subscribedMessDisplay || "").trim(),
      appliedDateStr: "",
      contactDuringLeave: String(contactDuringLeaveAddress || "").trim(),
      contactPhone: String(contactDuringLeavePhone || "").trim(),
    };

    console.log(`${LOG_FORM_ONLY} handler: building PDF`, {
      userId,
      inclusiveLeaveDays,
    });
    const pdfBuffer = await buildStationLeavePdf(pdfPayload);
    console.log(`${LOG_FORM_ONLY} handler: PDF built`, {
      userId,
      pdfBytes: pdfBuffer?.length ?? 0,
    });

    const leavePdfName = `station-leave-form-${req.user._id}-${Date.now()}.pdf`;
    console.log(`${LOG_FORM_ONLY} handler: uploading`, {
      userId,
      leavePdfName,
    });
    const leaveUp = await uploadBufferToLeaveFolder(
      pdfBuffer,
      "application/pdf",
      leavePdfName,
    );
    console.log(`${LOG_FORM_ONLY} handler: upload ok`, {
      userId,
      hasUrl: Boolean(leaveUp?.url),
    });

    await User.findByIdAndUpdate(req.user._id, {
      roomNumber: roomForPdf,
      ...(phoneTrim && { phoneNumber: phoneTrim }),
    });

    console.log(`${LOG_FORM_ONLY} handler: 201 success`, { userId });
    return res.status(201).json({
      message: "Leave form generated successfully",
      leaveDocumentUrl: leaveUp.url,
      formOnly: true,
    });
  } catch (err) {
    const graphErr = err?.response?.data?.error || err?.response?.data;
    console.error(`${LOG_FORM_ONLY} handler: 500`, {
      userId,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
      httpStatus: err?.response?.status,
      graphError: graphErr,
    });
    res.status(500).json({
      message: "Error generating leave form",
      error: err.message,
    });
  }
};

const validateIntersection = async (req) => {
  const { startDate, endDate } = req.body;

  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);

  // console.log(startDate, endDate);

  // console.log("Starting to validate intersection for user");

  let conflictStartDate = null;
  let conflictEndDate = null;

  const id = req.user;
  // console.log(id);

  let myApplications = await getMyApplications(req.user, "date");

  if (!myApplications || !Array.isArray(myApplications)) {
    return {
      isWithinRange: false,
      conflictStartDate: null,
      conflictEndDate: null,
    };
  }

  myApplications = myApplications.filter((application) =>
    ["Pending", "Acknowledged"].includes(application.status),
  );

  const isWithinRange = myApplications.some((application) => {
    const applicationStart = application.startDate;
    const applicationEnd = application.endDate;
    // console.log(applicationStart, " ",applicationEnd, " ", application._id);
    const check =
      (applicationStart <= start && start <= applicationEnd) ||
      (applicationStart <= end && end <= applicationEnd);
    if (check) {
      conflictStartDate = applicationStart;
      conflictEndDate = applicationEnd;
    }

    return check;
  });

  let answer = { isWithinRange, conflictStartDate, conflictEndDate };

  return answer;
};

const REBATE_SEMESTER_MAX_DAYS = 21;
/** Latest calendar start date (local midnight) allowed for mess rebate / station leave apply. */
const REBATE_START_MAX_DAYS_AHEAD = 30;

function latestRebateStartDateAllowed() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + REBATE_START_MAX_DAYS_AHEAD);
  return t;
}
const LEAVE_STATUSES_COUNTING_FOR_SEMESTER_CAP = [
  "Pending",
  "Acknowledged",
  "Processed",
];

/** Calendar date at local midnight (avoids DST edge cases for day boundaries). */
function startOfLocalDay(d) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

/**
 * Inclusive calendar days in the intersection of [leaveStart, leaveEnd] and
 * [windowStart, windowEnd] (each end inclusive).
 */
function inclusiveOverlapDays(leaveStart, leaveEnd, windowStart, windowEnd) {
  const lo =
    startOfLocalDay(leaveStart) > startOfLocalDay(windowStart)
      ? startOfLocalDay(leaveStart)
      : startOfLocalDay(windowStart);
  const hi =
    startOfLocalDay(leaveEnd) < startOfLocalDay(windowEnd)
      ? startOfLocalDay(leaveEnd)
      : startOfLocalDay(windowEnd);
  if (lo > hi) return 0;
  const dayMs = 86400000;
  return Math.floor((hi - lo) / dayMs) + 1;
}

/**
 * Semesters: Jan–May and Jul–Nov (same calendar year). Returns windows that
 * overlap the given leave range (any year spanned by the range).
 */
function semesterWindowsIntersectingLeave(leaveStart, leaveEnd) {
  const y0 = leaveStart.getFullYear();
  const y1 = leaveEnd.getFullYear();
  const windows = [];
  for (let y = y0; y <= y1; y++) {
    windows.push({
      start: new Date(y, 0, 1),
      end: new Date(y, 4, 31),
    });
    windows.push({
      start: new Date(y, 6, 1),
      end: new Date(y, 10, 30),
    });
  }
  return windows.filter((w) => !(leaveEnd < w.start || leaveStart > w.end));
}

const DAY_MS = 86400000;

/**
 * Split [leaveStart, leaveEnd] into one segment per calendar month (local dates,
 * inclusive). Single-month ranges return one segment. Used so each month gets
 * its own Leave row while one combined PDF covers the full range.
 */
function splitLeaveRangeByCalendarMonth(leaveStart, leaveEnd) {
  const start = startOfLocalDay(leaveStart);
  const end = startOfLocalDay(leaveEnd);
  if (start > end) return [];

  const segments = [];
  let cur = new Date(start);

  while (cur <= end) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const lastOfMonth = new Date(y, m + 1, 0);
    const segEnd = end.getTime() <= lastOfMonth.getTime() ? end : lastOfMonth;
    segments.push({ start: new Date(cur), end: new Date(segEnd) });
    const nextDay = new Date(segEnd);
    nextDay.setDate(nextDay.getDate() + 1);
    cur = startOfLocalDay(nextDay);
  }
  return segments;
}

const SEMESTER_CAP_MESSAGE =
  "In a semester, you can apply rebate for a total of 21 days only. If you still want to apply then please contact your Hostel Office.";

async function assertRebateSemesterDayCap(userId, newStart, newEnd) {
  const windows = semesterWindowsIntersectingLeave(newStart, newEnd);
  if (windows.length === 0) return null;

  const applications = await Leave.find({
    user: userId,
    status: { $in: LEAVE_STATUSES_COUNTING_FOR_SEMESTER_CAP },
  })
    .select({ startDate: 1, endDate: 1 })
    .lean();

  for (const w of windows) {
    let used = 0;
    for (const app of applications) {
      used += inclusiveOverlapDays(app.startDate, app.endDate, w.start, w.end);
    }
    const newPart = inclusiveOverlapDays(newStart, newEnd, w.start, w.end);
    if (used + newPart > REBATE_SEMESTER_MAX_DAYS) {
      return { message: SEMESTER_CAP_MESSAGE };
    }
  }
  return null;
}

// Apply for leave(Student endpoint)
export const applyForLeave = async (req, res) => {
  const userId = req.user?._id?.toString?.() ?? String(req.user?._id ?? "");
  try {
    const {
      leaveType,
      startDate,
      endDate,
      bankAccountNumber,
      bankIFSCCode,
      bankName,
      bankAccountHoldersName,
      homePermanentAddress,
      studentDeptLabel,
      studentProgrammeLabel,
      stationLeavePurpose,
      contactDuringLeaveAddress,
      contactDuringLeavePhone,
      semesterDisplay,
      registeredInCurrentSemester,
      declarationAccepted,
      roomNumber,
      phoneNumber,
      studentName,
      rollNumber,
      residentHostel,
      subscribedMessDisplay,
      email,
    } = req.body;

    console.log(`${LOG_APPLY} start`, {
      userId: userId || "(none)",
      leaveType,
      startDate,
      endDate,
    });

    const decl =
      declarationAccepted === true ||
      declarationAccepted === "true" ||
      declarationAccepted === "1";
    if (!decl) {
      console.warn(`${LOG_APPLY} 400 declaration not accepted`, { userId });
      return res.status(400).json({
        message: "You must accept the declaration to submit",
      });
    }

    const registeredInCurrSem =
      registeredInCurrentSemester === true ||
      registeredInCurrentSemester === "true" ||
      registeredInCurrentSemester === "1";

    const phoneTrim = String(phoneNumber ?? "").trim();
    const emailTrim = String(email ?? "").trim();
    const bankAcctNorm = String(bankAccountNumber ?? "")
      .trim()
      .replace(/\s/g, "");
    if (!/^\d{6,20}$/.test(bankAcctNorm)) {
      console.warn(`${LOG_APPLY} 400 invalid bank account number`, { userId });
      return res.status(400).json({
        message:
          "Invalid bank account number. Use 6 to 20 digits only (no letters or symbols).",
      });
    }

    let proofDocumentUrl = null;
    let leaveDocumentUrl = null;

    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);

    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setHours(0, 0, 0, 0);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    if (leaveType === "Medical" || leaveType === "Academic") {
      if (start < tomorrow) {
        return res.status(400).json({
          message: "Application must be submitted at least before 1 day",
        });
      }
    }
    if (leaveType === "Casual") {
      if (start < dayAfterTomorrow) {
        return res.status(400).json({
          message: "Application must be submitted at least before 2 days",
        });
      }
    }

    const latestStartOk = latestRebateStartDateAllowed();
    if (start > latestStartOk) {
      return res.status(400).json({
        message: `Start date cannot be more than ${REBATE_START_MAX_DAYS_AHEAD} days from today`,
      });
    }

    const diffBtwDates = Math.abs(end - start);
    const numberOfDays = Math.floor(diffBtwDates / (1000 * 60 * 60 * 24));

    if (numberOfDays < 3) {
      return res.status(400).json({
        message: "Number of days must be greater than or equal to 4",
      });
    }

    const inclusiveLeaveDays = numberOfDays + 1;

    if (
      !(
        leaveType == "Academic" ||
        leaveType == "Medical" ||
        leaveType == "Casual"
      )
    ) {
      return res.status(400).json({
        message: "Leave type is invalid",
      });
    }

    if (end - start < 0) {
      return res.status(400).json({
        message: "Start, end date combination is invalid",
      });
    }

    const doesItIntersect = await validateIntersection(req);
    if (doesItIntersect.isWithinRange) {
      doesItIntersect.conflictStartDate.setDate(
        doesItIntersect.conflictStartDate.getDate() + 1,
      );
      doesItIntersect.conflictEndDate.setDate(
        doesItIntersect.conflictEndDate.getDate() + 1,
      );
      console.warn(`${LOG_APPLY} 400 date conflict with existing application`, {
        userId,
      });
      return res.status(400).json({
        message: `The leave conflicts with a leave between ${doesItIntersect.conflictStartDate.toISOString().split("T")[0]} and ${doesItIntersect.conflictEndDate.toISOString().split("T")[0]}`,
      });
    }

    const semesterCapErr = await assertRebateSemesterDayCap(
      req.user._id,
      start,
      end,
    );
    if (semesterCapErr) {
      console.warn(`${LOG_APPLY} 400 semester rebate day cap`, { userId });
      return res.status(400).json({ message: semesterCapErr.message });
    }

    const appliedAt = new Date(Date.now());

    if (!(req.user && req.user.curr_subscribed_mess)) {
      if (req.user && !req.user.curr_subscribed_mess) {
        return res.status(400).json({
          message: "Hostel not provided",
        });
      }
      return res.status(400).json({
        message: "Please login first",
      });
    }

    const proofFile = req.files?.proofDocument?.[0];
    if (leaveType === "Academic" && !proofFile) {
      return res.status(400).json({
        message: "Please upload proof document",
      });
    }
    if (leaveType === "Casual" && proofFile) {
      return res.status(400).json({
        message: "Proof document is not required for casual leave",
      });
    }

    console.log(`${LOG_APPLY} validations passed; building PDF`, {
      userId,
      leaveType,
      inclusiveLeaveDays,
      hasProofFile: Boolean(proofFile),
    });

    const roomForPdf = String(roomNumber ?? "").trim();

    const pdfPayload = {
      studentName: String(studentName || "").trim(),
      rollNo: String(rollNumber || "").trim(),
      dept: String(studentDeptLabel || "").trim(),
      programme: String(studentProgrammeLabel || "").trim(),
      semesterLabel: String(semesterDisplay || "").trim(),
      residentHostel: String(residentHostel || "").trim(),
      roomNo: roomForPdf,
      email: emailTrim,
      mobile: phoneTrim,
      registeredCurrentSem: registeredInCurrSem,
      homeAddress: String(homePermanentAddress || "").trim(),
      bankAcName: bankAccountHoldersName,
      bankName,
      bankAcNo: bankAcctNorm,
      bankIfsc: bankIFSCCode,
      purpose: String(stationLeavePurpose || "").trim(),
      dateFromStr: formatDdMmYyyy(start),
      dateToStr: formatDdMmYyyy(end),
      totalDays: String(inclusiveLeaveDays),
      leaveTimeStr: "00:01 AM",
      inTimeStr: "11:59 PM",
      subscribedMess: String(subscribedMessDisplay || "").trim(),
      appliedDateStr: "",
      contactDuringLeave: String(contactDuringLeaveAddress || "").trim(),
      contactPhone: String(contactDuringLeavePhone || "").trim(),
    };

    const pdfBuffer = await buildStationLeavePdf(pdfPayload);
    console.log(`${LOG_APPLY} PDF generated`, {
      userId,
      pdfBytes: pdfBuffer?.length ?? 0,
    });
    const leavePdfName = `station-leave-${req.user._id}-${Date.now()}.pdf`;
    console.log(`${LOG_APPLY} uploading leave PDF`, { userId, leavePdfName });
    const leaveUp = await uploadBufferToLeaveFolder(
      pdfBuffer,
      "application/pdf",
      leavePdfName,
    );
    leaveDocumentUrl = leaveUp.url;
    console.log(`${LOG_APPLY} leave PDF uploaded`, {
      userId,
      hasUrl: Boolean(leaveDocumentUrl),
    });

    if (proofFile) {
      const proofName = `proof-${req.user._id}-${Date.now()}-${proofFile.originalname}`;
      console.log(`${LOG_APPLY} uploading proof document`, {
        userId,
        proofName,
        proofBytes: proofFile.buffer?.length ?? 0,
        mimetype: proofFile.mimetype,
      });
      const pUp = await uploadBufferToLeaveFolder(
        proofFile.buffer,
        proofFile.mimetype,
        proofName,
      );
      proofDocumentUrl = pUp.url;
      console.log(`${LOG_APPLY} proof uploaded`, {
        userId,
        hasUrl: Boolean(proofDocumentUrl),
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      roomNumber: roomForPdf,
      ...(phoneTrim && { phoneNumber: phoneTrim }),
    });

    const segments = splitLeaveRangeByCalendarMonth(start, end);
    const baseApplication = {
      user: req.user._id,
      leaveType,
      status: "Pending",
      ...(proofDocumentUrl && { proofDocumentUrl }),
      leaveDocumentUrl,
      appliedAt,
      messHostel: req.user.curr_subscribed_mess,
      bankAccountNumber: bankAcctNorm,
      bankIFSCCode,
      bankName,
      bankAccountHoldersName,
    };

    const savedLeaves = [];
    for (const seg of segments) {
      const diffSeg = Math.abs(seg.end - seg.start);
      const segNumberOfDays = Math.floor(diffSeg / DAY_MS);
      const applicationData = {
        ...baseApplication,
        startDate: seg.start,
        endDate: seg.end,
        numberOfDays: segNumberOfDays,
      };
      const leaveApplication = new Leave(applicationData);
      await leaveApplication.save();
      savedLeaves.push(leaveApplication);
    }

    console.log(`${LOG_APPLY} DB rows saved`, {
      userId,
      segmentCount: savedLeaves.length,
      leaveIds: savedLeaves.map((d) => String(d._id)),
    });

    const leaveApplication = savedLeaves[0];
    const rebateEstimateInr = Math.round(119 * inclusiveLeaveDays);

    console.log(`${LOG_APPLY} 201 success`, {
      userId,
      primaryLeaveId: String(leaveApplication._id),
      segmentCount: savedLeaves.length,
    });

    return res.status(201).json({
      message: "Leave Application submitted successfully",
      leaveApplication: {
        id: leaveApplication._id,
        user: req.user._id,
        inclusiveLeaveDays,
        status: leaveApplication.status,
        appliedAt: leaveApplication.appliedAt,
      },
      leaveApplications: savedLeaves.map((doc) => ({
        id: doc._id,
        user: doc.user,
        startDate: doc.startDate.toISOString().split("T")[0],
        endDate: doc.endDate.toISOString().split("T")[0],
        inclusiveLeaveDays: doc.numberOfDays + 1,
        status: doc.status,
        appliedAt: doc.appliedAt,
      })),
      leaveDocumentUrl,
      estimatedRebateAmountInr: rebateEstimateInr,
    });
  } catch (err) {
    const graphErr = err?.response?.data?.error || err?.response?.data;
    console.error(`${LOG_APPLY} 500 Error submitting leave application`, {
      userId,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
      httpStatus: err?.response?.status,
      graphError: graphErr,
    });
    res.status(500).json({
      message: "Error submitting leave application",
      error: err.message,
    });
  }
};

const getMyApplications = async (id, type) => {
  const myApplicationswithDate = await Leave.find({
    user: id,
  })
    .sort({
      appliedAt: -1,
    })
    .lean();

  if (myApplicationswithDate.length === 0) {
    return null;
  }

  const myApplications = myApplicationswithDate.map((application) => ({
    ...application,
    startDate: application.startDate.toISOString().split("T")[0],
    endDate: application.endDate.toISOString().split("T")[0],
  }));

  //If type is date then return with date object intact
  //Else return it stringified
  return type === "date" ? myApplicationswithDate : myApplications;
};

export const getApplications = async (req, res) => {
  //Search by User ObjectID
  const myApplications = await getMyApplications(req.user, "string");

  //For empty applications array
  if (myApplications == null) {
    res.status(200).json({
      message: "No past applications available",
    });
    return;
  }

  res.status(200).json({
    message: "Retrieved applications successfully",
    myApplications,
  });
  return;
};

export const getApplicationByID = async (req, res) => {
  const { id } = req.params;
  //Search by Application ObjectID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({
      message: "Incorrect Object ID format",
    });
    return;
  } else {
    try {
      let application = await Leave.findById(id).lean();

      if (!application.user.equals(req.user._id)) {
        application = null;
      }

      //For empty appplication variable
      if (application == null) {
        res.status(404).json({
          message: "There are no such leave applications",
        });
      } else {
        res.status(200).json({
          message: "Application retrieved successfully",
          application,
        });
      }
    } catch (err) {
      res.status(500).json({
        message: "Invalid request",
        error: err.message,
      });
    }
  }
};

/**
 * Stream proof bytes for the owner. Tries the stored URL directly (Graph
 * download links), then Graph "shares" API for org-view links — same idea as
 * mess-manager download, so mobile clients do not hit anonymous 403s.
 */
export const streamMyProofDocument = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Incorrect application ID format" });
  }
  try {
    const application = await Leave.findById(id).lean();
    if (!application) {
      return res
        .status(404)
        .json({ message: "There are no such leave applications" });
    }
    if (!application.user.equals(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const url = application.proofDocumentUrl?.trim();
    if (!url) {
      return res.status(404).json({ message: "No proof document attached" });
    }

    try {
      const r = await axios.get(url, {
        responseType: "arraybuffer",
        maxRedirects: 15,
        timeout: 120000,
        headers: {
          Accept: "*/*",
          "User-Agent":
            "Mozilla/5.0 (compatible; IITG-HAB/1.0; +https://hab.codingclub.in)",
        },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      const ct = String(r.headers["content-type"] || "").toLowerCase();
      if (r.status === 200 && r.data && !ct.includes("text/html")) {
        res.setHeader(
          "Content-Type",
          ct.split(";")[0].trim() || "application/octet-stream",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="proof-${Date.now()}"`,
        );
        return res.send(Buffer.from(r.data));
      }
    } catch (e) {
      console.warn("[Leave] Direct proof URL fetch failed:", e?.message || e);
    }

    return downloadFromOnedrive(url, res);
  } catch (err) {
    console.error("[Leave] streamMyProofDocument", err);
    if (!res.headersSent) {
      return res.status(500).json({
        message: "Failed to fetch proof document",
        error: err.message,
      });
    }
  }
};

/** Calendar-month split segments from one submission share [leaveDocumentUrl]. */
function siblingLeaveFilter(userId, leaveDocumentUrl) {
  return {
    user: userId,
    leaveDocumentUrl,
  };
}

function leaveSegmentOverlapsToday(startDate, endDate) {
  const now = new Date();
  const endExclusive = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate() + 1,
  );
  return startDate <= now && now <= endExclusive;
}

export const validateUploadDoc = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error("Please provide application ID");
      return res.status(400).json({
        message: "Please provide application ID",
      });
    }
    // Do not populate user with "-_id" — that drops owner id and breaks the
    // String(user) === req.user._id check (object stringifies to "[object Object]" → 403).
    const targetApplication = await Leave.findById(id).lean();

    if (!targetApplication) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (String(targetApplication.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (targetApplication.leaveType !== "Medical") {
      return res.status(400).json({
        message: "Late upload is only for medical leave",
      });
    }

    if (targetApplication.status !== "Pending") {
      return res.status(400).json({
        message: "This operation is invalid for this aplication",
        reason: `This application is already ${targetApplication.status}`,
      });
    }

    const siblings = await Leave.find(
      siblingLeaveFilter(
        targetApplication.user,
        targetApplication.leaveDocumentUrl,
      ),
    ).lean();

    const hasProofInGroup = siblings.some(
      (s) => s.proofDocumentUrl && String(s.proofDocumentUrl).trim() !== "",
    );
    if (hasProofInGroup) {
      return res.status(400).json({
        message: "Medical certificate already uploaded",
        reason:
          "This leave spans more than one month. A medical proof is already attached to another part of the same leave.",
        code: "MEDICAL_PROOF_ALREADY_UPLOADED",
      });
    }
    //tentative startdate
    const appliedAt = targetApplication.appliedAt.toISOString();
    const endDate = targetApplication.endDate.toISOString();

    const [appliedYear, appliedMonth, appliedDay] = appliedAt
      .split("-")
      .map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const start = new Date(appliedYear, appliedMonth - 1, appliedDay);
    const end = new Date(endYear, endMonth - 1, endDay);

    const time = Date.now();

    const diffBtwDates = Math.abs(start - time);

    if (Math.floor((time - end) / (1000 * 60 * 24 * 60)) >= 0) {
      return res.status(400).json({
        message: "Uloading of medical certificate is not allowed",
        reason: "Mess rebate time period has already ended",
      });
    }

    const numberOfDays = Math.floor(diffBtwDates / (1000 * 60 * 60 * 24));

    if (numberOfDays > 7) {
      console.error(
        "The time limit of uploading medical certificate has exceeded",
      );
      return res.status(400).json({
        message: "The time limit of uploading medical certificate has exceeded",
      });
    }

    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      message: "Error in validating request",
      error: err.message,
    });
  }
};

export const uploadDocForMedicalLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const proofUrl = req.uploadedDocuments?.proofDocument?.url;
    if (!proofUrl) {
      return res.status(400).json({
        message: "No file was uploaded",
      });
    }

    const application = await Leave.findById(id);
    if (!application || !application.user.equals(req.user._id)) {
      return res.status(404).json({ message: "Application not found" });
    }
    if (application.leaveType !== "Medical") {
      return res.status(400).json({
        message: "This upload is only for medical leave",
      });
    }
    if (application.status !== "Pending") {
      return res.status(400).json({
        message: "Cannot upload proof for this application",
        reason: `This application is already ${application.status}`,
      });
    }

    const updateResult = await Leave.updateMany(
      {
        ...siblingLeaveFilter(
          req.user._id,
          application.leaveDocumentUrl,
        ),
        leaveType: "Medical",
        status: "Pending",
      },
      { $set: { proofDocumentUrl: proofUrl } },
    );

    const updatedDoc = await Leave.findById(id).populate(
      "user",
      "name rollNumber email",
    );

    return res.status(201).json({
      message:
        "Medical certificate uploaded. The same proof is linked to all months of this leave.",
      application: updatedDoc,
      segmentsUpdated: updateResult.modifiedCount,
    });
  } catch (err) {
    return res.status(500).json({
      message: "File could not be uploaded",
      error: err.message,
    });
  }
};

export const cancelApplication = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error("Application ID not provided");
      return res.status(400).json({
        message: "Application ID not provided",
      });
    }

    const application = await Leave.findById(id);
    if (!application || !application.user.equals(req.user._id)) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    if (application.status !== "Pending") {
      const reason =
        application.status === "Cancelled"
          ? "Application is already cancelled"
          : application.status === "Acknowledged"
            ? "Cancellation is not allowed after the mess manager has acknowledged this application"
            : application.status === "Processed"
              ? "Cancellation is not allowed after this application has been processed"
              : `Cancellation is not allowed for status: ${application.status}`;
      return res.status(400).json({
        message: "This application cannot be cancelled",
        reason,
      });
    }

    const group = await Leave.find(
      siblingLeaveFilter(
        application.user,
        application.leaveDocumentUrl,
      ),
    ).lean();

    const blocked = group.some(
      (g) => g.status === "Acknowledged" || g.status === "Processed",
    );
    if (blocked) {
      return res.status(400).json({
        message: "This leave can no longer be cancelled",
        reason:
          "This leave is split across months. Another part has already been acknowledged or processed, so cancellation is not allowed.",
        code: "LEAVE_GROUP_LOCKED",
      });
    }

    const pendingSiblings = await Leave.find({
      ...siblingLeaveFilter(
        application.user,
        application.leaveDocumentUrl,
      ),
      status: "Pending",
    })
      .select("_id startDate endDate")
      .lean();

    const pendingIds = pendingSiblings.map((p) => p._id);
    if (pendingIds.length === 0) {
      return res.status(400).json({
        message: "This application cannot be cancelled",
        reason: "No pending segments found for this leave.",
      });
    }

    await Leave.updateMany(
      { _id: { $in: pendingIds } },
      { $set: { status: "Cancelled" } },
    );

    for (const doc of pendingSiblings) {
      if (leaveSegmentOverlapsToday(doc.startDate, doc.endDate)) {
        await User.findOneAndUpdate(
          { _id: application.user },
          { scannerPermission: true },
        );
        break;
      }
    }

    const updatedDoc = await Leave.findById(id).populate(
      "user",
      "name rollNumber email",
    );

    const modifiedCount = pendingIds.length;

    return res.status(201).json({
      message:
        modifiedCount > 1
          ? `Cancelled ${modifiedCount} segments of this leave (same submission across months).`
          : "Application cancelled successfully",
      application: updatedDoc,
      cancelledCount: modifiedCount,
      cancelledIds: pendingIds.map((d) => String(d)),
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error in cancelling application",
      error: err.message,
    });
  }
};

/**
 * Mess-manager: list applications for this mess.
 * - With month + year: startDate falls in that calendar month; optional status.
 * - With status=Pending only (no month/year): all pending applications for the mess.
 */
export const getMessApplications = async (req, res) => {
  const query = { messHostel: req.managerHostel };
  const { month, year, status } = req.query;

  if (status) {
    query.status = status;
  }

  const hasMonth = month !== undefined && month !== "";
  const hasYear = year !== undefined && year !== "";

  if (hasMonth !== hasYear) {
    return res.status(400).json({
      message: "Provide both month and year, or neither with status=Pending",
    });
  }

  if (hasMonth && hasYear) {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (!(m >= 1 && m <= 12) || Number.isNaN(y)) {
      return res.status(400).json({ message: "Invalid month or year" });
    }
    query.startDate = {
      $gte: new Date(y, m - 1, 1),
      $lt: new Date(y, m, 1),
    };
  } else if (!hasMonth && !hasYear) {
    if (query.status !== "Pending") {
      return res.status(400).json({
        message:
          "Provide month and year to list applications, or status=Pending for all pending",
      });
    }
  }

  try {
    const applications = await Leave.find(query)
      .sort({ appliedAt: -1 })
      .populate("user", "name rollNumber email -_id");

    return res.status(200).json({
      message: "Applications retrieved successfully",
      applications,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error retrieving leave applications",
      error: err.message,
    });
  }
};

export const getApplicationSummary = async (req, res) => {
  const hostel = req.managerHostel._id;

  if (!(req.query.month && req.query.year)) {
    return res.status(400).json({
      message: "Year and month are required",
    });
  }

  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);

  if (!(month >= 1 && month <= 12) || Number.isNaN(year)) {
    return res.status(400).json({
      message: "Invalid month or year",
    });
  }

  const applicationSummary = await getRebateDaysForMonth(hostel, month, year);

  return res.status(200).json({
    message: "Application summary retrieved successfully",
    applicationSummary,
    rebateSummary: applicationSummary,
  });
};

export const acknowledgeRebateApplication = async (req, res) => {
  const { id } = req.params;

  try {
    let application = await Leave.findById(id);
    if (!application || !application.messHostel.equals(req.managerHostel._id)) {
      return res.status(401).json({
        message: "You are not authorised to do that",
      });
    }

    if (application.status !== "Pending") {
      console.error("This operation is not permitted");
      return res.status(400).json({
        message: "This operation is not permitted",
        cause:
          application.status === "Cancelled"
            ? "Application was cancelled by the student"
            : `Application is already ${application.status}`,
      });
    }

    const acknowledgedAt = new Date();
    const updatedDoc = await Leave.findByIdAndUpdate(
      id,
      { status: "Acknowledged", acknowledgedAt },
      { new: true },
    ).populate("user", "name rollNumber email");

    res.status(201).json({
      message: `Acknowledged application with ID ${id}`,
      updatedApplication: updatedDoc,
    });

    try {
      await sendNotificationToUser(
        updatedDoc.user._id,
        "Rebate application acknowledged",
        `Your rebate request for ${updatedDoc.startDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })} to ${updatedDoc.endDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })} has been acknowledged by your mess office.`,
      );
    } catch (e) {
      console.error("Error in sending notification", e);
    }
  } catch (err) {
    res.status(500).json({
      message: "Error acknowledging the leave application",
      error: err.message,
    });
  }
};
