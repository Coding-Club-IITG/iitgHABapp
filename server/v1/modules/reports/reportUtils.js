import { Report, REPORT_FILE_TYPES } from "./reportModel.js";

export function getNowIST() {
  // Date object in IST (Asia/Kolkata) expressed in local system tz;
  // used only for extracting month/year consistently.
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

export function assertReportFileType(fileType) {
  if (!REPORT_FILE_TYPES.includes(fileType)) {
    throw new Error(`Invalid report fileType: ${fileType}`);
  }
}

export async function saveReportEntry({ fileType, month, year, link }) {
  assertReportFileType(fileType);
  if (!month || month < 1 || month > 12) throw new Error("Invalid month");
  if (!year) throw new Error("Invalid year");
  if (!link || !String(link).trim()) throw new Error("Invalid link");

  return await Report.create({
    fileType,
    month,
    year,
    link: String(link).trim(),
  });
}

