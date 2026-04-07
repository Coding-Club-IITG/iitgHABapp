const Leave = require("./leaveModel.js");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { uploadToOnedrive } = require("./uploadToOnedrive.js");
const { User } = require("../user/userModel.js");

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

const uploadMiddleware = async (req, res, next) => {
  //console.log("Started uploading document to server");
  upload.single("proofDocument")(req, res, (err) => {
    if (err) {
      if (err.message == "UNSUPPORTED_FILE_TYPE") {
        res.status(400).json({
          message: "Invalid file Type. Only jpg, pdf, png are allowed!",
          error: err.message,
        });
        return;
      }
    }
    //console.log("Passing file to Onedrive Uploader System");
    next();
  });
};

// Get all approved leaves for a specific month/year
async function getRebateDaysForMonth(messHostelId, month, year) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  let query = {};


  //Find approved leaves in leaves database
  const leaves = await Leave.find({
    messHostel: messHostelId,
    status: "approved",
    isEligibleForRebate: true,
    $or: [{ startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } }],
  }).populate("user", "name rollNumber -_id").lean();

  query.totalRebateDays = leaves.reduce(
    (sum, leave) => sum + leave.eligibleDays,
    0,
  );
  query.eligibleApplications = leaves;

  return query;
}


//Validation of presence of all fields before uploading file to onedrive
const validateApply = async (req, res, next) => {
    const fields = [
      "leaveType",
      "startDate",
      "endDate",
      "bankAccountNumber",
      "bankIFSCCode",
      "bankName",
      "bankAccountHoldersName",
    ]

    const missingFields = fields.filter(field => !req.body[field]);

    if(missingFields.length>0) {
      console.error("Fields cannot be empty");
      return res.status(400).json({
        message: "Fields cannot be empty",
        emptyFields: missingFields,
      })
    }

    //console.log(req.body)

    next();
};

const conditionalUpload = (req, res, next) => {
  // If Medical and no proof, skip the upload steps
  if (req.body.leaveType === "Medical" && !req.body.proofDocument) {
    return next(); // Skip straight to validateApply
  }
  
  // Otherwise, run the upload middleware
  uploadMiddleware(req, res, next);
};


//Apply for leave(Student endpoint)
const applyForLeave = async (req, res) => {
  try {
    const {
      leaveType,
      startDate,
      endDate,
      bankAccountNumber,
      bankIFSCCode,
      bankName,
      bankAccountHoldersName,
    } = req.body;
    //No error handling required due to presence of validateApply()
    let proofDocumentUrl = null;
    let proofDocumentFilename = null;
    //File handling
    //If file is not uploaded and leave is not medical, Don't allow
    //Genration of Date object
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    
    //Generate tomorrow Date object
    const tomorrow = new Date();
    tomorrow.setHours(0,0,0,0);
    tomorrow.setDate(tomorrow.getDate()+1);
    
    if(start<tomorrow) {
      console.error("Application must be submitted at least before 1 day");
      return res.status(400).json({
        message: "Application must be submitted at least before 1 day",
      })
    }

    //Get difference between two dates
    const diffBtwDates = Math.abs(end - start);
    const numberOfDays = Math.floor(diffBtwDates / (1000 * 60 * 60 * 24));

    //numberofdays business logic

    if (numberOfDays < 4) {
      res.status(400).json({
        message: "Number of days must be greater than 4",
      });
      return;
    }

    let eligibleDays = 0;
    //Calculation of eligible days
    if (numberOfDays >= 4) {
      eligibleDays = numberOfDays;
    }

    //Validation Rules / Business logic
    if (!(leaveType == "Academic" || leaveType == "Medical" || leaveType == "Casual")) {
      res.status(400).json({
        message: "Leave type is invalid",        
      });
      return;
    }

    if (end - start < 0) {
      res.status(400).json({
        message: "Start, end date combination is invalid",
      });
      return;
    }

    //Autogenerated variables
    const appliedAt = new Date(Date.now());

    //Only if user exists
    if (req.user && req.user.curr_subscribed_mess) {
      if (!req.file) {
      if(!(req.body["leaveType"]==="Medical")) {
        res.status(400).json({
          message: "Please upload proof document",
        });
        return;
      }
    }
    else {
      await uploadToOnedrive(req,res,()=> {
        console.log("Coming back to controller");
      })
      //Obtain url and fileName generated by uploadToOnedrive.js
      proofDocumentUrl = req.file.leaveUrl;
      proofDocumentFilename = req.file.originalname;
    }
      const applicationData = {
        user: req.user,
        leaveType: leaveType,
        startDate: start,
        endDate: end,
        numberOfDays: numberOfDays,
        eligibleDays: eligibleDays,
        status: "pending",
        ...(req.file && {proofDocumentUrl: proofDocumentUrl}),
        ...(req.file && {proofDocumentFilename: proofDocumentFilename}),
        appliedAt: appliedAt,
        messHostel: req.user.curr_subscribed_mess,
        bankAccountNumber: bankAccountNumber,
        bankIFSCCode: bankIFSCCode,
        bankName: bankName,
        bankAccountHoldersName: bankAccountHoldersName,
      };
      const leaveApplication = new Leave(applicationData);

      await leaveApplication.save();

      res.status(201).json({
        message: "Leave Application submited successfully",
        leaveApplication: {
          id: leaveApplication._id,
          user: req.user._id,
          eligibleDays,
          status: leaveApplication.status,
          appliedAt: leaveApplication.appliedAt,
        },
      });
    } else {
      if (req.user && !req.user.curr_subscribed_mess) {
        res.status(400).json({
          message: "Hostel not provided",
        });
      }
      res.status(400).json({
        message: "Please login first",
      });
    }
  } catch (err) {
    console.error("Error submitting leave application",err);
    res.status(500).json({
      message: "Error submitting leave application",
      error: err.message,
    });
  }
};

const getApplications = async (req, res) => {
  //Search by User ObjectID
  const myApplicationswithDate = await Leave.find({
    user: req.user,
  }).sort({
    appliedAt: -1,
  }).lean();

  //For empty applications array
  if (myApplicationswithDate.length === 0) {
    res.status(200).json({
      message: "No past applications available",
    });
    return;
  }

  const myApplications = myApplicationswithDate.map(application => ({
    ...application,
    startDate: application.startDate.toISOString(),
    endDate: application.endDate.toISOString(),
  }));

  res.status(200).json({
    message: "Retrieved applications successfully",
    myApplications,
  });
  return;
};

const getApplicationByID = async (req, res) => {
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

const getApplicationProof = async (req, res) => {
  const { id } = req.params;
  //Retrieval of proofDocumentUrl from application ObjectID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({
      message: "Incorrect Object ID format",
    });
    return;
  } else {
    try {
      const application = await Leave.findOne({
        _id: id,
        user: req.user,
      }).lean();
      if (application == null) {
        res.status(404).json({
          message: "There are no such leave applications",
        });
      } else {
        res.status(200).json({
          message: "Information retrieved successfully",
          proofDocumentUrl: application.proofDocumentUrl,
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

const validateUploadDoc = async (req,res,next) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error("Please provide application ID");
        return res.status(400).json({
          message: "Please provide application ID",
        })
      }
      console.log("Application ID", id);
      const targetApplication = await Leave.findById(id).populate("user", "name rollNumber email -_id").lean();
      //tentative startdate
      const appliedAt = targetApplication.startDate.toISOString();
  
      const [appliedYear, appliedMonth, appliedDay] = appliedAt.split("-").map(Number);
      const start = new Date(appliedYear, appliedMonth - 1, appliedDay);
  
      const time = Date.now();
  
      const diffBtwDates = Math.abs(start - time);
      const numberOfDays = Math.floor(diffBtwDates / (1000 * 60 * 60 * 24));
  
      if(numberOfDays>7) {
        console.error("The time limit of uploading medical certificate has exceeded");
        return res.status(400).json({
          message: "The time limit of uploading medical certificate has exceeded",
        })
      }

      next();
  }
  catch(err) {
    console.error(err);
    return res.status(400).json({
      message: "Error in validating request",
      error: err.message,
    })
  }
  
}

const uploadDocForMedicalLeave = async (req,res) => {
  try {
    const { id } = req.params;
    const query = {proofDocumentUrl: req.file.leaveUrl};
    query.proofDocumentFilename = req.file.originalname;

    const updatedDoc = await Leave.findByIdAndUpdate(id, query, {new: true}).populate("user", "name rollNumber email -_id");

    return res.status(201).json({
      message: `Medical certificate successfully updated for Application ${id}`,
      application: updatedDoc,
    })

  }
  catch(err) {
    return res.status(500).json({
      message: "File could not be uploaded",
      error: err.message,
    })
  }

}

const cancelApplication = async (req,res) => {
  try {
    const { id } = req.params;
    if(!id) {
      console.error("Application ID not provided");
      return res.status(400).json({
        message: "Application ID not provided",
      })
    }

    const updatedDoc = await Leave.findByIdAndUpdate(id, {status: "cancelled"}, {new: true}).populate("user", "name rollNumber email -_id");

    return res.status(201).json({
      message: `Application with ID ${id} successfully cancelled`,
      application: updatedDoc,
    })
  }
  catch(err) {
    return res.status(500).json({
      message: "Error in cancelling application",
      error: err.message,
    })
  }
}

const getAllPendingApplications = async (req, res) => {
  const pendingApplications = await Leave.find({
    messHostel: req.hostel,
    status: "pending",
  })
    .sort({
      appliedAt: -1,
    })
    .populate("user", "name rollNumber email -_id");

  //For empty applications array
  if (pendingApplications.length === 0) {
    res.status(404).json({
      message: "No applications available",
    });
    return;
  }

  res.status(200).json({
    message: "Retrieved applications successfully",
    pendingApplications,
  });
  return;
};

const filterApplications = async (req, res) => {
  const query = {
    messHostel: req.hostel,
  };

  if (req.query.status) {
    query.status = req.query.status;
  }

  
  if (req.query.month && req.query.year) {
    let month = parseInt(req.query.month);
    let year = parseInt(req.query.year);
    if(!(month>0 && month <=12)) {
      console.error("Wrong month format");
      return res.status(400).json({
        message: "Wrong month format",
      })
    }
    query.startDate = {
      $gte: new Date(year, month - 1, 1),
      $lt: new Date(year, month, 1),
    };
  } else if (req.query.year && !req.query.month) {
      query.startDate = {
        $gte: new Date(req.query.year, 0, 1),
        $lt: new Date(req.query.year + 1, 0, 1),
      };
    }
    else if (req.query.month && !req.query.year) {
      console.error("Please input both year and month");
    return res.status(404).json({
      message: "Please input both year and month",
    });
    }

  try {
    const filteredApplications = await Leave.find(query).sort({
      appliedAt: -1,
    });

    if (filteredApplications.length === 0) {
      res.status(404).json({
        message: "No such applications could be found",
      });
      return;
    }

    res.status(200).json({
      message: "Documents fetched successfully",
      filteredApplications,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error occured while retrieving leave applications",
      error: err.message,
    });
  }
};

const approveApplication = async (req, res) => {
  const { id } = req.params;

  try {
    let application = await Leave.findById(id);
    if (!application.messHostel.equals(req.hostel._id)) {
      application = null;
    }

    if(!(application.status==="pending")) {
      console.error("This operation is not permitted");
      return res.status(400).json({
        message: "This operation is not permitted",
        cause: ((application.status==="cancelled")?"Application already cancelled by user":`Application already ${application.status}`),
      })
    }

    if (application !== null) {
      const query = { status: "approved" };
      if (req.body.feedback) {
        query.feedback = req.body.feedback;
      }

      if (application.eligibleDays >= 4) {
        console.log("Marking eligible for rebate = true");
        query.isEligibleForRebate = true;
      }

      const updatedDoc = await Leave.findByIdAndUpdate(id, query, {new: true}).populate("user", "name rollNumber email -_id");

      res.status(201).json({
        message: `Approved application with ID ${id}`,
        updatedApplication: updatedDoc,
      });
    } else {
      res.status(401).json({
        message: "You are not authorised to do that",
      });
    }
  } catch (err) {
    res.status(500).json({
      message: "Error in approving the leave application",
      error: err.message,
    });
  }
};

const rejectApplication = async (req, res) => {
  const { id } = req.params;

  try {
    let application = await Leave.findById(id);
    if (!application.messHostel.equals(req.hostel._id)) {
      application = null;
    }

    if(!(application.status==="pending")) {
      console.error("This operation is not permitted");
      return res.status(400).json({
        message: "This operation is not permitted",
        cause: ((application.status==="cancelled")?"Application already cancelled by user":`Application already ${application.status}`),
      })
    }

    if (application !== null) {
      const query = { status: "rejected" };
      if (req.body.feedback) {
        query.feedback = req.body.feedback;
      }

      const updatedDoc = await Leave.findByIdAndUpdate(id, query, {new: true}).populate("user", "name rollNumber email");

      if (updatedDoc.startDate <= new Date() && new Date() <= updatedDoc.endDate) {
        const updatedUser = await User.findOneAndUpdate({_id: updatedDoc.user._id}, { scannerPermission: true });
        console.log(updatedUser);
      }


      res.status(201).json({
        message: `Rejected application with ID ${id}`,
        updatedApplication: updatedDoc,
      });
    } else {
      res.status(401).json({
        message: "You are not authorised to do that",
      });
    }
  } catch (err) {
    res.status(500).json({
      message: "Error in approving the leave application",
      error: err.message,
    });
  }
};

const getRebateSummary = async (req, res) => {
  const hostel = req.hostel._id;

  if (!(req.query.month && req.query.year)) {
    console.error("Year or month not specified");
    return res.status(400).json({
      message: "Year or month not specified",
    });
  }

  let year = parseInt(req.query.year);
  let month = parseInt(req.query.month);

  if(!(month>0 && month<=12)) {
    console.error("Invalid month format");
    return res.status(400).json({
      message: "Invalid month format"
    })
  }

  console.log(`month = ${month} and year = ${year}`);

  const result = await getRebateDaysForMonth(hostel, month, year);

  res.status(200).json({
    message: "Rebate summary retrieved successfully",
    rebateSummary: result,
  });
};

module.exports = {
  uploadMiddleware,
  applyForLeave,
  getApplications,
  getApplicationByID,
  getApplicationProof,
  validateUploadDoc,
  uploadDocForMedicalLeave,
  cancelApplication,
  getAllPendingApplications,
  filterApplications,
  approveApplication,
  rejectApplication,
  getRebateSummary,
  validateApply,
  conditionalUpload,
};
