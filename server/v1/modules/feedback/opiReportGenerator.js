const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const backupDir = path.join(__dirname, "../../../backup");

const generateOpiReport = async ({
  windowNumber,
  windowLabel,
  feedbacks,
  subscribers,
  messes,
}) => {
  const wb = new ExcelJS.Workbook();

  // Colour palette
  const DARK_BLUE = "FF1F3864";
  const MED_BLUE = "FF2E5FA3";
  const LIGHT_BLUE = "FF4472C4";
  const ORANGE = "FFED7D31";
  const GREEN = "FF70AD47";
  const RED = "FFC00000";
  const ROW_STRIPE = "FFEEF3FB"; // odd data rows
  const WHITE = "FFFFFFFF"; // even data rows
  const YELLOW_CELL = "FFFFF2CC"; // OPI / Net OPI cells
  const WHITE_FONT = "FFFFFFFF";
  const BLACK_FONT = "FF000000";

  const font = (
    bold = false,
    color = BLACK_FONT,
    size = 10,
    name = "Calibri",
  ) => ({ name, size, bold, color: { argb: color } });

  const fill = (argb) => ({
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
  });

  const border = () => ({
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  });

  const center = { horizontal: "center", vertical: "middle", wrapText: true };
  const left = { horizontal: "left", vertical: "middle" };
  const numFmt2 = "0.00";

  // Helper: apply header style to a cell
  const styleHeader = (cell, bgArgb, bold = true) => {
    cell.font = font(bold, WHITE_FONT);
    cell.fill = fill(bgArgb);
    cell.border = border();
    cell.alignment = center;
  };

  // PREPARE DATA
  // Separate subscribers into app / no-app
  const subApp = subscribers.filter((s) => s.hasApp);
  const subNoApp = subscribers.filter((s) => !s.hasApp);

  // Separate feedbacks into regular and SMC
  const smcFeedbacks = feedbacks.filter((f) => f.smcFields);

  // SHEET 1: Subscribers (App)
  const wsApp = wb.addWorksheet("Subscribers (App)");
  wsApp.columns = [
    { key: "roll", width: 14 },
    { key: "name", width: 28 },
    { key: "hostel", width: 18 },
    { key: "mess", width: 24 },
    { key: "changed", width: 14 },
  ];

  // Row 1: title
  wsApp.mergeCells("A1:E1");
  const appTitle = wsApp.getCell("A1");
  appTitle.value = `Mess Subscription List — ${windowLabel} (App Installed)`;
  appTitle.font = font(true, WHITE_FONT, 12);
  appTitle.fill = fill(DARK_BLUE);
  appTitle.alignment = center;
  wsApp.getRow(1).height = 22;

  // Row 2: headers
  const appHeaders = [
    "Roll Number",
    "Name",
    "Hostel (Boarder)",
    "Current Subscribed Mess (Mar)",
    "Mess Changed?",
  ];
  appHeaders.forEach((h, i) => {
    const cell = wsApp.getCell(2, i + 1);
    cell.value = h;
    styleHeader(cell, MED_BLUE);
  });
  wsApp.getRow(2).height = 20;

  // Data rows
  subApp.forEach((s, idx) => {
    const row = wsApp.getRow(idx + 3);
    row.values = [
      s.rollno,
      s.name || "",
      s.hostelName || "",
      s.subscribedMessName || s.hostelName || "",
      s.messChanged ? "Yes" : "No",
    ];
    const bg = idx % 2 === 0 ? ROW_STRIPE : WHITE;
    row.eachCell((cell) => {
      cell.fill = fill(bg);
      cell.font = font(false, BLACK_FONT);
      cell.border = border();
      cell.alignment = left;
    });
    row.height = 15;
  });

  // SHEET 2: Subscribers (No App)
  const wsNoApp = wb.addWorksheet("Subscribers (No App)");
  wsNoApp.columns = [
    { key: "roll", width: 14 },
    { key: "hostel", width: 18 },
    { key: "mess", width: 24 },
    { key: "changed", width: 14 },
  ];

  wsNoApp.mergeCells("A1:D1");
  const noAppTitle = wsNoApp.getCell("A1");
  noAppTitle.value = `Mess Subscription List — ${windowLabel} (App Not Installed)`;
  noAppTitle.font = font(true, WHITE_FONT, 12);
  noAppTitle.fill = fill(DARK_BLUE);
  noAppTitle.alignment = center;
  wsNoApp.getRow(1).height = 22;

  const noAppHeaders = [
    "Roll Number",
    "Hostel (Boarder)",
    "Current Subscribed Mess (Mar)",
    "Mess Changed?",
  ];
  noAppHeaders.forEach((h, i) => {
    const cell = wsNoApp.getCell(2, i + 1);
    cell.value = h;
    styleHeader(cell, MED_BLUE);
  });
  wsNoApp.getRow(2).height = 20;

  subNoApp.forEach((s, idx) => {
    const row = wsNoApp.getRow(idx + 3);
    row.values = [
      s.rollno,
      s.hostelName || "",
      s.subscribedMessName || s.hostelName || "",
      s.messChanged ? "Yes" : "No",
    ];
    const bg = idx % 2 === 0 ? ROW_STRIPE : WHITE;
    row.eachCell((cell) => {
      cell.fill = fill(bg);
      cell.font = font(false, BLACK_FONT);
      cell.border = border();
      cell.alignment = left;
    });
    row.height = 15;
  });

  // SHEET 3: Feedbacks
  const wsFb = wb.addWorksheet("Feedbacks");
  wsFb.columns = [
    { key: "name", width: 30 },
    { key: "roll", width: 14 },
    { key: "caterer", width: 28 },
    { key: "breakfast", width: 14 },
    { key: "lunch", width: 14 },
    { key: "dinner", width: 14 },
  ];

  wsFb.mergeCells("A1:F1");
  const fbTitle = wsFb.getCell("A1");
  fbTitle.value = `Student Feedbacks — ${windowLabel}`;
  fbTitle.font = font(true, WHITE_FONT, 12);
  fbTitle.fill = fill(DARK_BLUE);
  fbTitle.alignment = center;
  wsFb.getRow(1).height = 22;

  const fbHeaders = [
    "Name",
    "Roll Number",
    "Caterer",
    "Breakfast",
    "Lunch",
    "Dinner",
  ];
  fbHeaders.forEach((h, i) => {
    const cell = wsFb.getCell(2, i + 1);
    cell.value = h;
    styleHeader(cell, MED_BLUE);
  });
  wsFb.getRow(2).height = 20;

  feedbacks.forEach((fb, idx) => {
    const row = wsFb.getRow(idx + 3);
    row.values = [
      fb.user?.name || "Anonymous",
      fb.user?.rollNumber || "",
      fb.catererName || "",
      fb.breakfast || "",
      fb.lunch || "",
      fb.dinner || "",
    ];
    const bg = idx % 2 === 0 ? ROW_STRIPE : WHITE;
    row.eachCell((cell) => {
      cell.fill = fill(bg);
      cell.font = font(false, BLACK_FONT);
      cell.border = border();
      cell.alignment = left;
    });
    row.height = 15;
  });

  // SHEET 4: SMC Fields
  const wsSmc = wb.addWorksheet("SMC Fields");
  wsSmc.columns = [
    { key: "name", width: 30 },
    { key: "roll", width: 14 },
    { key: "caterer", width: 28 },
    { key: "hygiene", width: 16 },
    { key: "waste", width: 16 },
    { key: "quality", width: 22 },
    { key: "uniform", width: 22 },
  ];

  wsSmc.mergeCells("A1:G1");
  const smcTitle = wsSmc.getCell("A1");
  smcTitle.value = `SMC Inspection Feedbacks — ${windowLabel}`;
  smcTitle.font = font(true, WHITE_FONT, 12);
  smcTitle.fill = fill(DARK_BLUE);
  smcTitle.alignment = center;
  wsSmc.getRow(1).height = 22;

  const smcHeaders = [
    "Name",
    "Roll Number",
    "Caterer",
    "Hygiene",
    "Waste Disposal",
    "Quality of Ingredients",
    "Uniform & Punctuality",
  ];
  smcHeaders.forEach((h, i) => {
    const cell = wsSmc.getCell(2, i + 1);
    cell.value = h;
    styleHeader(cell, MED_BLUE);
  });
  wsSmc.getRow(2).height = 20;

  smcFeedbacks.forEach((fb, idx) => {
    const row = wsSmc.getRow(idx + 3);
    row.values = [
      fb.user?.name || "Anonymous",
      fb.user?.rollNumber || "",
      fb.catererName || "",
      fb.smcFields?.hygiene || "",
      fb.smcFields?.wasteDisposal || "",
      fb.smcFields?.qualityOfIngredients || "",
      fb.smcFields?.uniformAndPunctuality || "",
    ];
    const bg = idx % 2 === 0 ? ROW_STRIPE : WHITE;
    row.eachCell((cell) => {
      cell.fill = fill(bg);
      cell.font = font(false, BLACK_FONT);
      cell.border = border();
      cell.alignment = left;
    });
    row.height = 15;
  });

  // SHEET 5: OPI Report
  const wsOpi = wb.addWorksheet("OPI Report");

  // Column widths
  wsOpi.getColumn("A").width = 14;
  wsOpi.getColumn("B").width = 30;
  wsOpi.getColumn("C").width = 13;
  wsOpi.getColumn("D").width = 11;
  wsOpi.getColumn("E").width = 11;
  wsOpi.getColumn("F").width = 20;
  wsOpi.getColumn("G").width = 14;
  wsOpi.getColumn("H").width = 15;
  wsOpi.getColumn("I").width = 20;
  wsOpi.getColumn("J").width = 14;
  wsOpi.getColumn("K").width = 14;
  wsOpi.getColumn("L").width = 13;
  wsOpi.getColumn("M").width = 18;
  wsOpi.getColumn("N").width = 13;
  wsOpi.getColumn("O").width = 11;
  wsOpi.getColumn("P").width = 11;
  wsOpi.getColumn("Q").width = 11;
  wsOpi.getColumn("R").width = 12;
  wsOpi.getColumn("S").width = 0; // hidden helper column

  // Determine row ranges dynamically from actual data sizes
  // These are inserted as literal numbers into the formulas so the formulas
  // remain accurate regardless of how many rows each data sheet has.
  const fbLastRow = Math.max(feedbacks.length + 2, 3); // Feedbacks data: rows 3..fbLastRow
  const subAppLast = Math.max(subApp.length + 2, 3); // Subscribers (App): rows 3..subAppLast
  const subNoLast = Math.max(subNoApp.length + 2, 3); // Subscribers (No App): rows 3..subNoLast
  const smcLastRow = Math.max(smcFeedbacks.length + 2, 3); // SMC Fields: rows 3..smcLastRow

  // Row 1: Main title
  wsOpi.mergeCells("A1:R1");
  const opiTitle = wsOpi.getCell("A1");
  opiTitle.value = `OPI REPORT — WINDOW ${windowNumber}`;
  opiTitle.font = font(true, WHITE_FONT, 13);
  opiTitle.fill = fill(DARK_BLUE);
  opiTitle.alignment = center;
  wsOpi.getRow(1).height = 27.75;

  // Row 2: Formula legend
  wsOpi.mergeCells("A2:R2");
  const opiFormula = wsOpi.getCell("A2");
  opiFormula.value =
    "Formulas:  OPI_meal = (Σresponses + 4×(Subscribers − Responses)) / Subscribers  |  OPI_smc = Σresponses / Responses  |  Net OPI = (10B + 10L + 10D + 2U + 4C + 1W + 3Q) / 40";
  opiFormula.font = font(false, WHITE_FONT, 9);
  opiFormula.fill = fill(MED_BLUE);
  opiFormula.alignment = { ...left, wrapText: true };
  wsOpi.getRow(2).height = 27.75;

  // Row 3: Section headers
  wsOpi.mergeCells("A3:B3");
  const h3A = wsOpi.getCell("A3");
  h3A.value = "Catering Service & Hostel";
  styleHeader(h3A, DARK_BLUE);

  wsOpi.mergeCells("C3:E3");
  const h3C = wsOpi.getCell("C3");
  h3C.value = "Student Feedback — Avg of Overall Satisfaction";
  styleHeader(h3C, LIGHT_BLUE);

  wsOpi.mergeCells("F3:I3");
  const h3F = wsOpi.getCell("F3");
  h3F.value = "SMC Feedback";
  styleHeader(h3F, ORANGE);

  wsOpi.mergeCells("J3:M3");
  const h3J = wsOpi.getCell("J3");
  h3J.value = "OPI Validity Calculation";
  styleHeader(h3J, MED_BLUE);

  wsOpi.mergeCells("N3:P3");
  const h3N = wsOpi.getCell("N3");
  h3N.value = "Student Meal OPI";
  styleHeader(h3N, GREEN);

  // Q3 and R3 are not merged
  const h3Q = wsOpi.getCell("Q3");
  h3Q.value = "Net OPI";
  styleHeader(h3Q, RED);

  const h3R = wsOpi.getCell("R3");
  h3R.value = "Rank";
  styleHeader(h3R, DARK_BLUE);

  wsOpi.getRow(3).height = 27.75;

  // Row 4: Column sub-headers
  const row4Headers = [
    ["A4", "HOSTEL", DARK_BLUE],
    ["B4", "Caterer", DARK_BLUE],
    ["C4", "Avg Breakfast", LIGHT_BLUE],
    ["D4", "Avg Lunch", LIGHT_BLUE],
    ["E4", "Avg Dinner", LIGHT_BLUE],
    ["F4", "Uniform & Punctuality", ORANGE],
    ["G4", "Cleanliness & Hygiene", ORANGE],
    ["H4", "Waste Disposal", ORANGE],
    ["I4", "Quality of Ingredients", ORANGE],
    ["J4", "Total Responses", MED_BLUE],
    ["K4", "Total Subscribers", MED_BLUE],
    ["L4", "SMC Responses", MED_BLUE],
    ["M4", "Subscriber Feedback %", MED_BLUE],
    ["N4", "OPI Breakfast", GREEN],
    ["O4", "OPI Lunch", GREEN],
    ["P4", "OPI Dinner", GREEN],
    ["Q4", "Net OPI", RED],
    ["R4", "Rank", DARK_BLUE],
  ];
  row4Headers.forEach(([addr, val, bg]) => {
    const cell = wsOpi.getCell(addr);
    cell.value = val;
    styleHeader(cell, bg);
  });
  wsOpi.getRow(4).height = 27.75;

  // Data Rows (one per mess/hostel)
  // messes is expected sorted in display order, matching what the app calculates.
  // Each mess has: { hostelName, name (caterer) }
  const dataStartRow = 5;

  messes.forEach((mess, idx) => {
    const r = dataStartRow + idx;
    const caterer = mess.name;
    const hostel = mess.hostelName;

    // Alternating row backgrounds
    const baseBg = idx % 2 === 0 ? ROW_STRIPE : WHITE;
    const opiBg = YELLOW_CELL;

    // Helper: set cell formula + style
    const setCell = (col, formula, bg, bold = false, numFmt = null) => {
      const cell = wsOpi.getCell(r, col);
      cell.value = { formula };
      cell.font = font(bold, BLACK_FONT);
      cell.fill = fill(bg);
      cell.border = border();
      cell.alignment = center;
      if (numFmt) cell.numFmt = numFmt;
    };

    const setVal = (col, value, bg, bold = false, numFmt = null) => {
      const cell = wsOpi.getCell(r, col);
      cell.value = value;
      cell.font = font(bold, BLACK_FONT);
      cell.fill = fill(bg);
      cell.border = border();
      cell.alignment = center;
      if (numFmt) cell.numFmt = numFmt;
    };

    // A: Hostel name
    setVal(1, hostel, baseBg);

    // B: Caterer name
    setVal(2, caterer, baseBg);

    // C: Avg Breakfast — SUMPRODUCT formula over Feedbacks sheet
    // =IF(COUNTIF(Feedbacks!C3:C{last},"{caterer}")>0,
    //    SUMPRODUCT((Feedbacks!C3:C{last}="{caterer}")*
    //      ((Feedbacks!D3:D{last}="Very Poor")*1+...+"Very Good")*5))
    //    / COUNTIF(Feedbacks!C3:C{last},"{caterer}"), "")
    const fbCatFilter = (colLetter, ratingCol) =>
      `IF(COUNTIF(Feedbacks!C3:C${fbLastRow},"${caterer}")>0,` +
      `SUMPRODUCT((Feedbacks!C3:C${fbLastRow}="${caterer}")*` +
      `((Feedbacks!${ratingCol}3:${ratingCol}${fbLastRow}="Very Poor")*1+` +
      `(Feedbacks!${ratingCol}3:${ratingCol}${fbLastRow}="Poor")*2+` +
      `(Feedbacks!${ratingCol}3:${ratingCol}${fbLastRow}="Average")*3+` +
      `(Feedbacks!${ratingCol}3:${ratingCol}${fbLastRow}="Good")*4+` +
      `(Feedbacks!${ratingCol}3:${ratingCol}${fbLastRow}="Very Good")*5))` +
      `/COUNTIF(Feedbacks!C3:C${fbLastRow},"${caterer}"), "")`;

    setCell(3, fbCatFilter("C", "D"), baseBg, false, numFmt2); // Avg Breakfast
    setCell(4, fbCatFilter("C", "E"), baseBg, false, numFmt2); // Avg Lunch
    setCell(5, fbCatFilter("C", "F"), baseBg, false, numFmt2); // Avg Dinner

    // F-I: SMC Fields — SUMPRODUCT over SMC Fields sheet
    // Cols in SMC sheet: C=caterer, D=Hygiene, E=Waste, F=Quality, G=Uniform
    const smcFilter = (smcCol) =>
      `IF(COUNTIF('SMC Fields'!C3:C${smcLastRow},"${caterer}")>0,` +
      `SUMPRODUCT(('SMC Fields'!C3:C${smcLastRow}="${caterer}")*` +
      `(('SMC Fields'!${smcCol}3:${smcCol}${smcLastRow}="Very Poor")*1+` +
      `('SMC Fields'!${smcCol}3:${smcCol}${smcLastRow}="Poor")*2+` +
      `('SMC Fields'!${smcCol}3:${smcCol}${smcLastRow}="Average")*3+` +
      `('SMC Fields'!${smcCol}3:${smcCol}${smcLastRow}="Good")*4+` +
      `('SMC Fields'!${smcCol}3:${smcCol}${smcLastRow}="Very Good")*5))` +
      `/COUNTIF('SMC Fields'!C3:C${smcLastRow},"${caterer}"), "")`;

    setCell(6, smcFilter("G"), baseBg, false, numFmt2); // F: Uniform & Punctuality  (SMC col G)
    setCell(7, smcFilter("D"), baseBg, false, numFmt2); // G: Cleanliness & Hygiene  (SMC col D)
    setCell(8, smcFilter("E"), baseBg, false, numFmt2); // H: Waste Disposal          (SMC col E)
    setCell(9, smcFilter("F"), baseBg, false, numFmt2); // I: Quality of Ingredients  (SMC col F)

    // J: Total Responses (feedbacks count for this caterer)
    setCell(10, `COUNTIF(Feedbacks!C3:C${fbLastRow},"${caterer}")`, baseBg);

    // K: Total Subscribers (from both subscriber sheets)
    setCell(
      11,
      `COUNTIF('Subscribers (App)'!D3:D${subAppLast},"${hostel}")+` +
        `COUNTIF('Subscribers (No App)'!C3:C${subNoLast},"${hostel}")`,
      baseBg,
    );

    // L: SMC Responses
    setCell(12, `COUNTIF('SMC Fields'!C3:C${smcLastRow},"${caterer}")`, baseBg);

    // M: Subscriber Feedback % = (J/K)*100
    const Jref = `J${r}`;
    const Kref = `K${r}`;
    setCell(
      13,
      `IF(${Kref}>0,(${Jref}/${Kref})*100,"")`,
      baseBg,
      false,
      "0.00",
    );

    // N: OPI Breakfast = (C*J + 4*(K-J)) / K
    const Cref = `C${r}`;
    const Dref = `D${r}`;
    const Eref = `E${r}`;
    setCell(
      14,
      `IF(${Kref}>0,(${Cref}*${Jref}+4*(${Kref}-${Jref}))/${Kref},"")`,
      opiBg,
      false,
      numFmt2,
    );

    // O: OPI Lunch
    setCell(
      15,
      `IF(${Kref}>0,(${Dref}*${Jref}+4*(${Kref}-${Jref}))/${Kref},"")`,
      opiBg,
      false,
      numFmt2,
    );

    // P: OPI Dinner
    setCell(
      16,
      `IF(${Kref}>0,(${Eref}*${Jref}+4*(${Kref}-${Jref}))/${Kref},"")`,
      opiBg,
      false,
      numFmt2,
    );

    // Q: Net OPI = (10B + 10L + 10D + 2U + 4C + 1W + 3Q) / 40
    const Fref = `F${r}`;
    const Gref = `G${r}`;
    const Href = `H${r}`;
    const Iref = `I${r}`;
    const Nref = `N${r}`;
    const Oref = `O${r}`;
    const Pref = `P${r}`;
    setCell(
      17,
      `IF(${Kref}>0,(10*${Nref}+10*${Oref}+10*${Pref}+2*IF(${Fref}="",0,${Fref})+4*IF(${Gref}="",0,${Gref})+1*IF(${Href}="",0,${Href})+3*IF(${Iref}="",0,${Iref}))/40,"")`,
      opiBg,
      true,
      numFmt2,
    );

    // R: Rank (counts rows with >=40% feedback rate that have higher Net OPI)
    const Mref = `M${r}`;
    setCell(
      18,
      `IF(${Mref}>=40,COUNTIF($M$${dataStartRow}:${Mref},">=40"),"Unranked")`,
      baseBg,
    );

    // S: Helper column (hidden) — 1 if eligible for ranking, 0 otherwise
    const cellS = wsOpi.getCell(r, 19);
    cellS.value = { formula: `--(${Mref}>=40)` };
    cellS.font = font(false, BLACK_FONT);
    wsOpi.getRow(r).height = 15;
  });

  // Serialise to buffer
  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
};

// Save OPI Report to backup
const saveOpiReportBackup = async (buffer, filename) => {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const filePath = path.join(backupDir, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`[OPI] Saved report backup to ${filePath}`);
  return filePath;
};

module.exports = { generateOpiReport, saveOpiReportBackup };
