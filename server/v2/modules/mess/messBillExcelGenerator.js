/**
 * Builds the 4-sheet mess bill Excel workbook (ExcelJS).
 * Sheet order: Mess Subscribers → Mess Rebates → Payroll → Bill Summary.
 *
 * Formatting matches the reference Excel exactly:
 *  - Font: Calibri 11 throughout (9pt for Payroll data, 12–13pt for titles)
 *  - No fill / no background colours except:
 *      • Payroll header row: gray (D3D3D3)
 *      • Payroll "Total Gross" + "Net Payment" cols + totals: yellow (FFFF00)
 *      • Bill Summary "Total Wage" cell: yellow (FFFF00)
 *  - All data cells have thin borders on all four sides
 *  - Bold only where explicitly noted below
 */

import ExcelJS from "exceljs";
import mongoose from "mongoose";

import UserAllocHostel from "../hostel/hostelAllocModel.js";
import { Hostel } from "../hostel/hostelModel.js";
import { MessWorker } from "./messWorkerModel.js";
import Leave from "../leave/leaveModel.js";
import { subscribedMessDisplayName } from "../../utils/subscribedMessDisplay.js";

// ─── constants ────────────────────────────────────────────────────────────────
const REBATE_RATE_PER_DAY = 119;

const ALLOC_POPULATE_MESS = {
  path: "current_subscribed_mess",
  select: "hostel_name messId",
  populate: { path: "messId", select: "name" },
};

// ─── style helpers ────────────────────────────────────────────────────────────

/** Standard thin border on all four sides */
const THIN_BORDER = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
};

/** Top + bottom only (used on payroll column-number row) */
const TB_BORDER = {
  top: { style: "thin" },
  bottom: { style: "thin" },
};

/** Bottom only (used on payroll ESIC deduction header) */
const BOT_BORDER = {
  bottom: { style: "thin" },
};

const YELLOW_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFF00" },
};
const GRAY_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD3D3D3" },
};

/**
 * Apply the standard "data cell" style to a cell.
 * @param {ExcelJS.Cell} cell
 * @param {{ bold?, size?, hAlign?, vAlign?, wrap?, fill?, border?, numFmt? }} opts
 */
function styleCell(
  cell,
  {
    bold = false,
    size = 11,
    hAlign = "left",
    vAlign = "middle",
    wrap = false,
    fill = null,
    border = THIN_BORDER,
    numFmt = null,
  } = {},
) {
  cell.font = { name: "Calibri", bold, size };
  cell.alignment = { horizontal: hAlign, vertical: vAlign, wrapText: wrap };
  cell.border = border;
  if (fill) cell.fill = fill;
  if (numFmt) cell.numFmt = numFmt;
}

// ─── main export ──────────────────────────────────────────────────────────────

export async function buildMessBillExcelWorkbook({
  hostelId,
  billData,
  workerAttendances,
  messId,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HAB";
  wb.created = new Date();

  // ── fetch hostel info ────────────────────────────────────────────────────
  const hostel = await Hostel.findById(hostelId)
    .select("hostel_name messId")
    .populate({ path: "messId", select: "name" })
    .lean();

  const messHostelName = hostel?.hostel_name || "";
  const messLabel = hostel?.messId?.name || messHostelName || "";

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 1 – MESS SUBSCRIBERS
  // ════════════════════════════════════════════════════════════════════════════
  const wsSub = wb.addWorksheet("Mess Subscribers");

  wsSub.getColumn(1).width = 16;
  wsSub.getColumn(2).width = 30;
  wsSub.getColumn(3).width = 34;

  // Row 1 – title (merged A1:C1, bold 13, centered, thin border)
  wsSub.mergeCells("A1:C1");
  const subTitleCell = wsSub.getCell("A1");
  subTitleCell.value = "Mess Subscribers List";
  styleCell(subTitleCell, {
    bold: true,
    size: 13,
    hAlign: "center",
    border: THIN_BORDER,
  });
  wsSub.getRow(1).height = 18;

  // Row 2 – live count formula (merged A2:C2, right-aligned, thin border)
  wsSub.mergeCells("A2:C2");
  const subCountCell = wsSub.getCell("A2");
  subCountCell.value = { formula: '"Total Subscribers: "&COUNTA(A4:A1000)' };
  styleCell(subCountCell, { hAlign: "right", border: THIN_BORDER });
  wsSub.getRow(2).height = 18;

  // Row 3 – column headers (bold, centered)
  const subHeaders = ["Roll Number", "Boarding Hostel", "Mess (Subscribed)"];
  subHeaders.forEach((h, i) => {
    const cell = wsSub.getCell(3, i + 1);
    cell.value = h;
    styleCell(cell, { bold: true, hAlign: "center" });
  });
  wsSub.getRow(3).height = 18;

  // Data rows
  const allocs = await UserAllocHostel.find({
    current_subscribed_mess: hostelId,
  })
    .populate("hostel", "hostel_name")
    .populate(ALLOC_POPULATE_MESS)
    .sort({ rollno: 1 })
    .lean();

  allocs.forEach((a, idx) => {
    const rowNum = idx + 4;
    const boarding = a.hostel?.hostel_name || "";
    const subMess =
      subscribedMessDisplayName(a.current_subscribed_mess) ||
      a.current_subscribed_mess?.hostel_name ||
      messLabel;

    const rollCell = wsSub.getCell(rowNum, 1);
    rollCell.value = a.rollno;
    styleCell(rollCell, { hAlign: "center" });

    const boardCell = wsSub.getCell(rowNum, 2);
    boardCell.value = boarding;
    styleCell(boardCell, { hAlign: "left" });

    const messCell = wsSub.getCell(rowNum, 3);
    messCell.value = subMess;
    styleCell(messCell, { hAlign: "left" });

    wsSub.getRow(rowNum).height = 18;
  });

  wsSub.views = [{ state: "frozen", ySplit: 3 }];

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 2 – MESS REBATES
  // ════════════════════════════════════════════════════════════════════════════
  const wsRebate = wb.addWorksheet("Mess Rebates");

  const rebateColWidths = [22, 14, 30, 18, 13, 13, 12, 16, 22, 18, 14, 14];
  rebateColWidths.forEach((w, i) => {
    wsRebate.getColumn(i + 1).width = w;
  });
  wsRebate.getColumn(13).width = 16; // M – rate label
  wsRebate.getColumn(14).width = 12; // N – rate value

  // Row 1 – title (merged A1:L1)
  wsRebate.mergeCells("A1:L1");
  const rebateTitleCell = wsRebate.getCell("A1");
  rebateTitleCell.value = "Mess Rebate Applications";
  styleCell(rebateTitleCell, {
    bold: true,
    size: 13,
    hAlign: "center",
    border: THIN_BORDER,
  });
  wsRebate.getRow(1).height = 18;

  // N1 – rate value (editable, thin border, right-aligned label in M1)
  const rateLabelCell = wsRebate.getCell("M1");
  rateLabelCell.value = "Rate/day (₹):";
  styleCell(rateLabelCell, { bold: true, hAlign: "right", border: null });

  const rateValueCell = wsRebate.getCell("N1");
  rateValueCell.value = REBATE_RATE_PER_DAY;
  styleCell(rateValueCell, {
    hAlign: "center",
    border: THIN_BORDER,
    numFmt: "#,##0",
  });

  // Row 2 – info formula (merged A2:L2)
  wsRebate.mergeCells("A2:L2");
  const rebateInfoCell = wsRebate.getCell("A2");
  rebateInfoCell.value = {
    formula: '"Rate per day: ₹"&N1&"  |  Total applicants: "&COUNTA(A4:A1000)',
  };
  styleCell(rebateInfoCell, { hAlign: "right", border: THIN_BORDER });
  wsRebate.getRow(2).height = 18;

  // Row 3 – column headers
  const rebateHeaders = [
    "Name",
    "Roll Number",
    "Email",
    "Leave Type",
    "Start Date",
    "End Date",
    "No. of Days",
    "Amount (₹)",
    "Account Holder",
    "Account Number",
    "Bank Name",
    "IFSC Code",
  ];
  rebateHeaders.forEach((h, i) => {
    const cell = wsRebate.getCell(3, i + 1);
    cell.value = h;
    styleCell(cell, { bold: true, hAlign: "center" });
  });
  wsRebate.getRow(3).height = 18;

  // Data rows
  const rebateIds = (billData.rebateApplicationIds || [])
    .filter((id) => id && mongoose.isValidObjectId(String(id)))
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  let dataLastRow = 3;

  if (rebateIds.length) {
    const leaves = await Leave.find({ _id: { $in: rebateIds } })
      .populate("user", "name rollNumber email")
      .lean();

    leaves.forEach((L, idx) => {
      const rowNum = idx + 4;
      dataLastRow = rowNum;
      const days = Number(L.numberOfDays) || 0;

      const vals = [
        [L.user?.name || "", "left"],
        [L.user?.rollNumber ?? "", "center"],
        [L.user?.email || "", "left"],
        [L.leaveType || "", "left"],
        [L.startDate ? new Date(L.startDate) : "", "center"],
        [L.endDate ? new Date(L.endDate) : "", "center"],
      ];

      vals.forEach(([val, align], ci) => {
        const cell = wsRebate.getCell(rowNum, ci + 1);
        cell.value = val;
        styleCell(cell, { hAlign: align });
      });

      // Days – plain number, #,##0 format
      const daysCell = wsRebate.getCell(rowNum, 7);
      daysCell.value = days;
      styleCell(daysCell, { hAlign: "center", numFmt: "#,##0" });

      // Amount – formula referencing N1 rate cell
      const amtCell = wsRebate.getCell(rowNum, 8);
      amtCell.value = { formula: `G${rowNum}*$N$1` };
      styleCell(amtCell, { hAlign: "center", numFmt: "₹ #,##0.00" });

      // Bank details
      const bankVals = [
        L.bankAccountHoldersName || "",
        L.bankAccountNumber || "",
        L.bankName || "",
        L.bankIFSCCode || "",
      ];
      bankVals.forEach((val, ci) => {
        const cell = wsRebate.getCell(rowNum, ci + 9);
        cell.value = val;
        styleCell(cell, { hAlign: "left" });
      });

      wsRebate.getRow(rowNum).height = 18;
    });
  }

  // Blank spacer row
  const spacerRow = dataLastRow + 1;
  wsRebate.getRow(spacerRow).height = 6;

  // Total row (merged A:G, SUM formula in H)
  const totalRow = spacerRow + 1;
  wsRebate.mergeCells(`A${totalRow}:G${totalRow}`);

  const totalLabelCell = wsRebate.getCell(totalRow, 1);
  totalLabelCell.value = "Total Amount to be Paid (₹)";
  styleCell(totalLabelCell, {
    bold: true,
    hAlign: "right",
    border: THIN_BORDER,
  });

  const totalAmtCell = wsRebate.getCell(totalRow, 8);
  totalAmtCell.value = { formula: `SUM(H4:H${dataLastRow})` };
  styleCell(totalAmtCell, {
    bold: true,
    hAlign: "center",
    numFmt: "₹ #,##0.00",
    border: THIN_BORDER,
  });

  // Apply border to cols 9-12 of total row (blank but bordered)
  for (let c = 9; c <= 12; c++) {
    wsRebate.getCell(totalRow, c).border = THIN_BORDER;
  }
  wsRebate.getRow(totalRow).height = 18;

  wsRebate.views = [{ state: "frozen", ySplit: 3 }];

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 3 – PAYROLL
  // Exact layout from payroll.xlsx reference, Calibri font throughout.
  // ════════════════════════════════════════════════════════════════════════════
  const wsPay = wb.addWorksheet("Payroll");

  // Column widths (exact from reference)
  const payColWidths = [
    6, 20, 14, 7, 13, 10, 13, 12, 10, 13, 13, 12, 13, 10, 12,
  ];
  payColWidths.forEach((w, i) => {
    wsPay.getColumn(i + 1).width = w;
  });

  // ── Row 1: span header titles ──────────────────────────────────────────
  wsPay.getRow(1).height = 30;

  // B1:J1 – "PRINCIPAL EMPLOYER CONTRIBUTION" (Calibri 12, bold, centered, no fill)
  wsPay.mergeCells("B1:J1");
  const payTitleCell = wsPay.getCell("B1");
  payTitleCell.value = "PRINCIPAL EMPLOYER CONTRIBUTION";
  payTitleCell.font = { name: "Calibri", bold: true, size: 12 };
  payTitleCell.alignment = { horizontal: "center", vertical: "middle" };
  // no border on this cell (matches reference)

  // L1:M1 – ESIC deduction note (Calibri 9, bold, yellow fill, bottom border only)
  wsPay.mergeCells("L1:M1");
  const esicTitleCell = wsPay.getCell("L1");
  esicTitleCell.value = "[DEDUCT BY THE CATERER FOR PAYMENT OF EPF AND ESIC]";
  esicTitleCell.font = { name: "Calibri", bold: true, size: 9 };
  esicTitleCell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  esicTitleCell.fill = YELLOW_FILL;
  esicTitleCell.border = BOT_BORDER;

  // ── Row 2: column numbers 1-12 (cols D-O) ────────────────────────────
  wsPay.getRow(2).height = 15.75;
  for (let i = 0; i < 12; i++) {
    const cell = wsPay.getCell(2, i + 4); // cols D(4) to O(15)
    cell.value = i + 1;
    cell.font = { name: "Calibri", bold: true, size: 10 };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = TB_BORDER;
  }

  // ── Row 3: column headers ──────────────────────────────────────────────
  wsPay.getRow(3).height = 79.5;

  const payHeaderDefs = [
    { col: 1, text: "Sl. No", fill: GRAY_FILL },
    { col: 2, text: "Name", fill: GRAY_FILL },
    { col: 3, text: "Designation", fill: GRAY_FILL },
    { col: 4, text: "Rate", fill: GRAY_FILL },
    { col: 5, text: "Attendance", fill: GRAY_FILL },
    { col: 6, text: "Basic + VDA\n(Column 1 * Column 2)", fill: GRAY_FILL },
    {
      col: 7,
      text: "Service charge in the procurement of manpower outsourcing service (3% of Column 3)",
      fill: GRAY_FILL,
    },
    {
      col: 8,
      text: "{ER (3.67%) +EPS (8.33%) +EDLI (.5%)+ ADM CHARGE (.5%)}\n[Column 3 of 13%]\n[Ceiling Amount=1500]",
      fill: GRAY_FILL,
    },
    {
      col: 9,
      text: "ESI\n[Column 3 of 3.25%]\n[Ceiling Amount=21000]",
      fill: GRAY_FILL,
    },
    { col: 10, text: "Bonus\n(8.33% of 7000)", fill: GRAY_FILL },
    { col: 11, text: "Total Gross", fill: YELLOW_FILL },
    {
      col: 12,
      text: "EPF (Employer Contribution= Column 3 of 13%+ Employee Contribution=Column 3 of 12%)\n[Total 25%]",
      fill: GRAY_FILL,
    },
    {
      col: 13,
      text: "ESI\n(EMPLOYER CONTRIBUTION: Column 3 of 3.25%+ Employee Contribution = Column 3 of .75%)\n[Total 4%]",
      fill: GRAY_FILL,
    },
    {
      col: 14,
      text: "Service charge in the procurement of manpower outsourcing service\n(3% of Column 3)",
      fill: GRAY_FILL,
    },
    { col: 15, text: "Net payment to the employees", fill: YELLOW_FILL },
  ];

  payHeaderDefs.forEach(({ col, text, fill }) => {
    const cell = wsPay.getCell(3, col);
    cell.value = text;
    cell.font = { name: "Calibri", bold: true, size: 9 };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.fill = fill;
    cell.border = THIN_BORDER;
  });

  // ── Data rows ──────────────────────────────────────────────────────────
  const workers = messId
    ? await MessWorker.find({ messId }).sort({ name: 1 }).lean()
    : [];

  const att =
    workerAttendances && typeof workerAttendances === "object"
      ? workerAttendances
      : {};

  const DATA_START = 4;

  workers.forEach((w, idx) => {
    const rowNum = DATA_START + idx;
    const days = Number(att[String(w._id)] ?? att[w._id] ?? 26) || 0;
    const rate = Number(w.rate) || 0;
    wsPay.getRow(rowNum).height = 15.75;

    const baseStyle = { size: 9, border: THIN_BORDER };

    // Sl. No
    const slCell = wsPay.getCell(rowNum, 1);
    slCell.value = idx + 1;
    styleCell(slCell, { ...baseStyle, hAlign: "center" });

    // Name
    const nameCell = wsPay.getCell(rowNum, 2);
    nameCell.value = w.name;
    styleCell(nameCell, { ...baseStyle, hAlign: "left" });

    // Designation
    const desigCell = wsPay.getCell(rowNum, 3);
    desigCell.value = w.designation;
    styleCell(desigCell, { ...baseStyle, hAlign: "left" });

    // Rate (input)
    const rateCell = wsPay.getCell(rowNum, 4);
    rateCell.value = rate;
    styleCell(rateCell, { ...baseStyle, hAlign: "center" });

    // Attendance (input)
    const attCell = wsPay.getCell(rowNum, 5);
    attCell.value = days;
    styleCell(attCell, { ...baseStyle, hAlign: "center" });

    // Calculated columns F-O (formulas exactly matching reference)
    const r = rowNum;
    const formulas = [
      { col: 6, formula: `D${r}*E${r}`, fill: null },
      { col: 7, formula: `ROUND(F${r}*0.03,0)`, fill: null },
      { col: 8, formula: `ROUND(MIN(F${r},15000)*0.13,0)`, fill: null },
      {
        col: 9,
        formula: `IF(F${r}<=21000,ROUND(F${r}*0.0325,0),0)`,
        fill: null,
      },
      {
        col: 10,
        formula: `IF(F${r}>21000,0,ROUND(7000*0.0833,0))`,
        fill: null,
      },
      { col: 11, formula: `F${r}+G${r}+H${r}+I${r}+J${r}`, fill: YELLOW_FILL },
      { col: 12, formula: `ROUND(MIN(F${r},15000)*0.25,0)`, fill: null },
      {
        col: 13,
        formula: `IF(F${r}<=21000,ROUND(F${r}*0.04,0),0)`,
        fill: null,
      },
      { col: 14, formula: `G${r}`, fill: null },
      { col: 15, formula: `K${r}-L${r}-M${r}-N${r}`, fill: YELLOW_FILL },
    ];

    formulas.forEach(({ col, formula, fill }) => {
      const cell = wsPay.getCell(rowNum, col);
      cell.value = { formula };
      cell.font = { name: "Calibri", size: 9 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = THIN_BORDER;
      if (fill) cell.fill = fill;
    });
  });

  // ── Totals row ────────────────────────────────────────────────────────
  const lastDataRow = DATA_START + workers.length - 1;
  const totalsRowNum = lastDataRow + 1;
  wsPay.getRow(totalsRowNum).height = 15.75;

  // "TOTAL" label in col B
  const totalLabelPayCell = wsPay.getCell(totalsRowNum, 2);
  totalLabelPayCell.value = "TOTAL";
  totalLabelPayCell.font = { name: "Calibri", bold: true, size: 9 };

  // SUM formulas in cols F-O
  const sumCols = [
    { col: 6, fill: null },
    { col: 7, fill: null },
    { col: 8, fill: null },
    { col: 9, fill: null },
    { col: 10, fill: null },
    { col: 11, fill: YELLOW_FILL },
    { col: 12, fill: null },
    { col: 13, fill: null },
    { col: 14, fill: null },
    { col: 15, fill: YELLOW_FILL },
  ];

  sumCols.forEach(({ col, fill }) => {
    const colLetter = wsPay.getColumn(col).letter;
    const cell = wsPay.getCell(totalsRowNum, col);
    cell.value = {
      formula: `SUM(${colLetter}${DATA_START}:${colLetter}${lastDataRow})`,
    };
    cell.font = { name: "Calibri", bold: true, size: 9 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = THIN_BORDER;
    if (fill) cell.fill = fill;
  });

  wsPay.views = [{ state: "frozen", ySplit: 3 }];

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 4 – BILL SUMMARY
  // ════════════════════════════════════════════════════════════════════════════
  const wsSum = wb.addWorksheet("Bill Summary");

  wsSum.getColumn(1).width = 38;
  wsSum.getColumn(2).width = 22;
  wsSum.getColumn(3).width = 18;
  wsSum.getColumn(4).width = 38;

  // ── destructure billData ────────────────────────────────────────────────
  const {
    month,
    year,
    hostelName,
    accountNumber,
    operatingDays,
    shutdownDays,
    totalSubscribers,
    totalSubscribersOffset,
    rebateDays,
    rebateDaysOffset,
    miscDeduction,
  } = billData;

  const effN =
    (Number(totalSubscribers) || 0) + (Number(totalSubscribersOffset) || 0);
  const effR = (Number(rebateDays) || 0) + (Number(rebateDaysOffset) || 0);
  const shutdownVal = Number(shutdownDays) || 0;

  // payroll totals row number in the Payroll sheet
  const payTotalsRef = `Payroll!O${totalsRowNum}`;

  // ── helper: write one standard summary row ──────────────────────────────
  /**
   * @param {number} rowNum  Excel row number
   * @param {string} label   Col A label text
   * @param {string} note    Col B formula note
   * @param {*}      value   Col C value (string | number | {formula:string})
   * @param {{
   *   bold?:   boolean,   // applies to all three cells
   *   wrapA?:  boolean,   // wrap col A
   *   fillC?:  object,    // fill for col C
   *   numFmtC?: string,   // number format for col C
   *   rowH?:   number,    // row height (default 18)
   * }} opts
   */
  function sumRow(
    rowNum,
    label,
    note,
    value,
    {
      bold = false,
      wrapA = false,
      fillC = null,
      numFmtC = null,
      rowH = 18,
    } = {},
  ) {
    wsSum.getRow(rowNum).height = rowH;

    const cellA = wsSum.getCell(rowNum, 1);
    cellA.value = label;
    styleCell(cellA, {
      bold,
      hAlign: "left",
      wrap: wrapA,
      border: THIN_BORDER,
    });

    const cellB = wsSum.getCell(rowNum, 2);
    cellB.value = note;
    styleCell(cellB, { bold, hAlign: "center", border: THIN_BORDER });

    const cellC = wsSum.getCell(rowNum, 3);
    cellC.value = value;
    styleCell(cellC, {
      bold,
      hAlign: "center",
      fill: fillC,
      numFmt: numFmtC,
      border: THIN_BORDER,
    });
  }

  // ── Row 1 – title ────────────────────────────────────────────────────────
  wsSum.mergeCells("A1:C1");
  const sumTitleCell = wsSum.getCell("A1");
  sumTitleCell.value = "Mess Bill Calculation Sheet";
  styleCell(sumTitleCell, {
    bold: true,
    size: 13,
    hAlign: "center",
    border: THIN_BORDER,
  });
  // merged cells B1 and C1 need borders too
  wsSum.getCell("B1").border = THIN_BORDER;
  wsSum.getCell("C1").border = THIN_BORDER;
  wsSum.getRow(1).height = 18;

  // ── Rows 2–22 ────────────────────────────────────────────────────────────

  sumRow(2, "Month and Year", "", `${month}, ${year}`);
  sumRow(3, "Hostel Name", "", hostelName);
  sumRow(4, "Hostel Mess Account Number (Canara Bank)", "", accountNumber);
  sumRow(5, "No of mess operating Days", "D", operatingDays, {
    numFmtC: "#,##0",
  });
  sumRow(6, "Mess Shutdown Date", "", shutdownVal > 0 ? shutdownVal : "NA");
  sumRow(7, "Total No of mess subscribers", "N", effN, { numFmtC: "#,##0" });

  // Row 8: Mess Days = N × D  (formula)
  sumRow(
    8,
    "No of Mess Days (Actual days)",
    "M",
    { formula: "C7*C5" },
    { numFmtC: "#,##0" },
  );

  sumRow(9, "Total Rebate Days", "R", effR, { numFmtC: "#,##0" });

  // Row 10: Consuming Days = M − R
  sumRow(
    10,
    "Total no of consuming Days",
    "T1= M-R",
    { formula: "C8-C9" },
    { numFmtC: "#,##0" },
  );

  // Row 11: Food Cost = T1 × 119
  sumRow(
    11,
    "Food Cost",
    "F= T1 X 119",
    { formula: "C10*119" },
    { numFmtC: "#,##0" },
  );

  // Row 12: Total Wage – yellow fill, pulled from Payroll sheet
  sumRow(
    12,
    "Total Wage",
    "W",
    { formula: payTotalsRef },
    { numFmtC: "#,##0", fillC: YELLOW_FILL },
  );

  // Row 13: Mess Bill claimed = 1.05 × (F+W)
  sumRow(
    13,
    "Mess Bill (Claimed by caterer)",
    "B= 1.05 X (F+W)",
    { formula: "ROUND(1.05*(C11+C12),2)" },
    { numFmtC: "₹ #,##0.00" },
  );

  // Row 14: Mess Bill = F+W
  sumRow(
    14,
    "Mess Bill",
    "F+W",
    { formula: "C11+C12" },
    { numFmtC: "₹ #,##0.00" },
  );

  // Row 15: GST 5%
  sumRow(
    15,
    "GST Amount, 5%",
    "GST=5%*(F+W)",
    { formula: "ROUND(0.05*(C11+C12),2)" },
    { numFmtC: "₹ #,##0.00" },
  );

  // Row 16: TDS 2%
  sumRow(
    16,
    "TDS Amount",
    "T2= 0.02 X (F+W)",
    { formula: "ROUND(0.02*(C11+C12),2)" },
    { numFmtC: "₹ #,##0.00" },
  );

  // Row 17: First Installment (bold, multi-line, taller)
  sumRow(
    17,
    "First Installment of Payment\nfrom hostel office to the caterer",
    "P1= B-(T2+(0.2*F))-Misc",
    { formula: "ROUND(C13-C16-ROUND(0.2*C11,0)-C20,0)" },
    { bold: true, wrapA: true, numFmtC: "₹ #,##0", rowH: 36 },
  );

  // Row 18: Second Installment (bold, multi-line, taller)
  sumRow(
    18,
    "Second Installment of Payment from\nhostel office to the caterer",
    "P2= 0.2 X F",
    { formula: "ROUND(0.2*C11,0)" },
    { bold: true, wrapA: true, numFmtC: "₹ #,##0", rowH: 36 },
  );

  // Row 19: Rebate Reimbursement (multi-line, taller)
  sumRow(
    19,
    "Rebate Reimbursement\n(hostel office should relese to the student)",
    "RR= R X 119",
    { formula: "C9*119" },
    { wrapA: true, numFmtC: "₹ #,##0", rowH: 36 },
  );

  // Row 20: Misc deduction (editable input)
  sumRow(20, "Misc deduction", "Misc", Number(miscDeduction) || 0, {
    numFmtC: "#,##0",
  });

  // Row 21: HAB Transfer
  sumRow(
    21,
    "HAB Transfer to hostel offices",
    "T3=P1+P2+RR",
    { formula: "C17+C18+C19" },
    { numFmtC: "₹ #,##0" },
  );

  // Row 22: Total Expenditure (bold, multi-line, taller)
  sumRow(
    22,
    "Total Mess bill Expenditure\n(For HAB Office Use Only)",
    "T2+T3",
    { formula: "C16+C21" },
    { bold: true, wrapA: true, numFmtC: "₹ #,##0", rowH: 36 },
  );

  // ── Blank row + verification ─────────────────────────────────────────
  wsSum.getRow(23).height = 18;

  const verifyCell = wsSum.getCell("A24");
  verifyCell.value =
    "Above data has been verified and found to be true and correct.";
  verifyCell.font = { name: "Calibri", size: 11 };
  verifyCell.alignment = { horizontal: "left", vertical: "middle" };
  wsSum.getRow(24).height = 18;

  // ════════════════════════════════════════════════════════════════════════════
  return wb.xlsx.writeBuffer();
}
