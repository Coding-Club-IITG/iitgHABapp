import ExcelJS from "exceljs";

export const generateMessChangeReport = async ({
  users,
  acceptedUsers,
  rejectedUsers,
  capacityTracker,
  hostels,
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

  const styleHeader = (cell, bgArgb, bold = true) => {
    cell.font = font(bold, WHITE_FONT);
    cell.fill = fill(bgArgb);
    cell.border = border();
    cell.alignment = center;
  };

  const hostelMap = hostels.reduce((acc, h) => {
    acc[h._id.toString()] = h.hostel_name;
    return acc;
  }, {});

  // Data Preparation
  const sortedUsers = [...users].sort(
    (a, b) =>
      new Date(a.applied_hostel_timestamp || 0) -
      new Date(b.applied_hostel_timestamp || 0),
  );
  const sortedAccepted = [...acceptedUsers].sort((a, b) => {
    const uA = users.find((u) => u._id.toString() === a.id);
    const uB = users.find((u) => u._id.toString() === b.id);
    return (
      new Date(uA?.applied_hostel_timestamp || 0) -
      new Date(uB?.applied_hostel_timestamp || 0)
    );
  });
  const sortedRejected = [...rejectedUsers].sort((a, b) => {
    const uA = users.find((u) => u._id.toString() === a.id);
    const uB = users.find((u) => u._id.toString() === b.id);
    return (
      new Date(uA?.applied_hostel_timestamp || 0) -
      new Date(uB?.applied_hostel_timestamp || 0)
    );
  });

  // SHEET 1: All Applications
  const wsAll = wb.addWorksheet("All Applications");
  wsAll.columns = [
    { key: "roll", width: 15 },
    { key: "name", width: 30 },
    { key: "boarding", width: 20 },
    { key: "pref1", width: 20 },
    { key: "pref2", width: 20 },
    { key: "pref3", width: 20 },
    { key: "timestamp", width: 25 },
  ];

  wsAll.mergeCells("A1:G1");
  const allTitle = wsAll.getCell("A1");
  allTitle.value = "All Mess Change Applications";
  allTitle.font = font(true, WHITE_FONT, 12);
  allTitle.fill = fill(DARK_BLUE);
  allTitle.alignment = center;
  wsAll.getRow(1).height = 22;

  const allHeaders = [
    "Roll Number",
    "Name",
    "Boarding Hostel",
    "Preference 1",
    "Preference 2",
    "Preference 3",
    "Application Timestamp",
  ];
  allHeaders.forEach((h, i) => {
    const cell = wsAll.getCell(2, i + 1);
    cell.value = h;
    styleHeader(cell, MED_BLUE);
  });
  wsAll.getRow(2).height = 20;

  sortedUsers.forEach((u, idx) => {
    const row = wsAll.getRow(idx + 3);
    row.values = [
      u.rollNumber || "",
      u.name || "",
      hostelMap[u.hostel?.toString()] || "Unknown",
      hostelMap[u.next_mess1?.toString()] || "N/A",
      hostelMap[u.next_mess2?.toString()] || "N/A",
      hostelMap[u.next_mess3?.toString()] || "N/A",
      u.applied_hostel_timestamp
        ? new Date(u.applied_hostel_timestamp).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "",
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

  // SHEET 2: Accepted Applications
  const wsAccepted = wb.addWorksheet("Accepted Applications");
  wsAccepted.columns = [
    { key: "roll", width: 15 },
    { key: "boarding", width: 20 },
    { key: "new", width: 20 },
    { key: "timestamp", width: 25 },
  ];

  wsAccepted.mergeCells("A1:D1");
  const accTitle = wsAccepted.getCell("A1");
  accTitle.value = "Accepted Mess Change Applications";
  accTitle.font = font(true, WHITE_FONT, 12);
  accTitle.fill = fill(GREEN);
  accTitle.alignment = center;
  wsAccepted.getRow(1).height = 22;

  const accHeaders = [
    "Roll Number",
    "Boarding Hostel",
    "New Hostel",
    "Timestamp",
  ];
  accHeaders.forEach((h, i) => {
    const cell = wsAccepted.getCell(2, i + 1);
    cell.value = h;
    styleHeader(cell, MED_BLUE);
  });
  wsAccepted.getRow(2).height = 20;

  sortedAccepted.forEach((a, idx) => {
    const u = users.find((user) => user._id.toString() === a.id);
    const row = wsAccepted.getRow(idx + 3);
    row.values = [
      a.rollNumber || "",
      hostelMap[a.fromHostelId?.toString()] || "Unknown",
      hostelMap[a.toHostelId?.toString()] || "Unknown",
      u?.applied_hostel_timestamp
        ? new Date(u.applied_hostel_timestamp).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "",
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

  // SHEET 3: Rejected Applications
  const wsRejected = wb.addWorksheet("Rejected Applications");
  wsRejected.columns = [
    { key: "roll", width: 15 },
    { key: "boarding", width: 20 },
    { key: "pref1", width: 20 },
    { key: "pref2", width: 20 },
    { key: "pref3", width: 20 },
    { key: "timestamp", width: 25 },
  ];

  wsRejected.mergeCells("A1:F1");
  const rejTitle = wsRejected.getCell("A1");
  rejTitle.value = "Rejected Mess Change Applications";
  rejTitle.font = font(true, WHITE_FONT, 12);
  rejTitle.fill = fill(RED);
  rejTitle.alignment = center;
  wsRejected.getRow(1).height = 22;

  const rejHeaders = [
    "Roll Number",
    "Boarding Hostel",
    "Preference 1",
    "Preference 2",
    "Preference 3",
    "Timestamp",
  ];
  rejHeaders.forEach((h, i) => {
    const cell = wsRejected.getCell(2, i + 1);
    cell.value = h;
    styleHeader(cell, MED_BLUE);
  });
  wsRejected.getRow(2).height = 20;

  sortedRejected.forEach((r, idx) => {
    const u = users.find((user) => user._id.toString() === r.id);
    const row = wsRejected.getRow(idx + 3);
    row.values = [
      r.rollNumber || "",
      hostelMap[r.fromHostelId?.toString()] || "Unknown",
      hostelMap[u?.next_mess1?.toString()] || "N/A",
      hostelMap[u?.next_mess2?.toString()] || "N/A",
      hostelMap[u?.next_mess3?.toString()] || "N/A",
      u?.applied_hostel_timestamp
        ? new Date(u.applied_hostel_timestamp).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "",
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

  // SHEET 4: Report Summary
  const wsSummary = wb.addWorksheet("Report Summary");
  wsSummary.columns = [
    { key: "hostel", width: 20 },
    { key: "boarders", width: 15 },
    { key: "subscribers", width: 18 },
    { key: "incoming", width: 12 },
    { key: "outgoing", width: 12 },
    { key: "net", width: 15 },
  ];

  wsSummary.mergeCells("A1:F1");
  const sumTitle = wsSummary.getCell("A1");
  sumTitle.value = "Mess Change Report Summary";
  sumTitle.font = font(true, WHITE_FONT, 12);
  sumTitle.fill = fill(DARK_BLUE);
  sumTitle.alignment = center;
  wsSummary.getRow(1).height = 22;

  const sumHeaders = [
    "Hostel",
    "Boarders",
    "Mess Subscribers",
    "Incoming",
    "Outgoing",
    "Net Change",
  ];
  sumHeaders.forEach((h, i) => {
    const cell = wsSummary.getCell(2, i + 1);
    cell.value = h;
    styleHeader(cell, MED_BLUE);
  });
  wsSummary.getRow(2).height = 20;

  hostels.forEach((h, idx) => {
    const id = h._id.toString();
    const tracker = capacityTracker[id] || {};
    const finalCount =
      tracker.finalCount !== undefined ? tracker.finalCount : tracker.current;
    const incoming = acceptedUsers.filter(
      (a) => a.toHostelId?.toString() === id,
    ).length;
    const outgoing = acceptedUsers.filter(
      (a) => a.fromHostelId?.toString() === id,
    ).length;
    const net = incoming - outgoing;

    const row = wsSummary.getRow(idx + 3);
    row.values = [
      h.hostel_name || "Unknown",
      h.curr_cap || 0,
      finalCount || 0,
      incoming,
      outgoing,
      net,
    ];

    const bg = idx % 2 === 0 ? ROW_STRIPE : WHITE;
    row.eachCell((cell, i) => {
      cell.fill = fill(bg);
      cell.font = font(i === 6, BLACK_FONT); // Bold net change
      cell.border = border();
      cell.alignment = center;
    });
    row.height = 15;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
};
