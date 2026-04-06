const BugReport = require("./bugReportModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for screenshot uploads
const uploadDir = path.join(__dirname, "../../../uploads/bug-reports");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `bug-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// Middleware for handling multiple file uploads
const uploadMiddleware = upload.array("screenshots", 5); // Max 5 screenshots

const createBugReport = async (req, res) => {
  try {
    const { title, description, email, deviceInfo, frequency } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        message: "Title and description are required",
      });
    }

    // Get screenshot URLs if files were uploaded
    const screenshots = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        // Store the file path - in production, upload to cloud storage (S3, etc.)
        screenshots.push({
          url: `/api/bug-report/files/${file.filename}`,
          filename: file.originalname,
        });
      });
    }

    const bugReport = new BugReport({
      title,
      description,
      email: email || null,
      reportedBy: req.user ? req.user._id : null,
      screenshots,
      deviceInfo: deviceInfo ? JSON.parse(deviceInfo) : null,
      frequency: frequency || null,
    });

    await bugReport.save();

    res.status(201).json({
      message: "Bug report submitted successfully",
      bugReport: {
        id: bugReport._id,
        title: bugReport.title,
        status: bugReport.status,
      },
    });
  } catch (error) {
    console.error("Error creating bug report:", error);
    res.status(500).json({
      message: "Failed to submit bug report",
      error: error.message,
    });
  }
};

const getBugReports = async (req, res) => {
  try {
    // Only admins can view bug reports
    const bugReports = await BugReport.find()
      .populate("reportedBy", "name rollNumber email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      bugReports,
    });
  } catch (error) {
    console.error("Error fetching bug reports:", error);
    res.status(500).json({
      message: "Failed to fetch bug reports",
      error: error.message,
    });
  }
};

const updateBugReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "in_progress", "resolved", "closed"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const bugReport = await BugReport.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!bugReport) {
      return res.status(404).json({
        message: "Bug report not found",
      });
    }

    res.status(200).json({
      message: "Bug report status updated",
      bugReport,
    });
  } catch (error) {
    console.error("Error updating bug report:", error);
    res.status(500).json({
      message: "Failed to update bug report",
      error: error.message,
    });
  }
};

module.exports = {
  createBugReport,
  getBugReports,
  updateBugReportStatus,
  uploadMiddleware,
};

