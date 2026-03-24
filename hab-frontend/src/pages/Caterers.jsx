import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Button, Typography, Space, Tag, Select, Spin } from "antd";
import { PlusOutlined, DownloadOutlined } from "@ant-design/icons";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getAllMesses, getMessById } from "../apis/mess";
import { BACKEND_URL } from "../apis/server";
import FeedbackControl from "../components/FeedbackControl";

const { Title } = Typography;
// Search removed per requirement

export default function Caterers() {
  const [messes, setMesses] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loadingMesses, setLoadingMesses] = useState(true);
  // Search removed
  // Feedback window + leaderboard states
  const [windows, setWindows] = useState([]);
  const [selectedWindow, setSelectedWindow] = useState("");
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [loadingWindows, setLoadingWindows] = useState(false);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [, setError] = useState("");
  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");
  const navigate = useNavigate();
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const fetchMesses = async () => {
    try {
      setLoadingMesses(true);
      const data = await getAllMesses();

      // Transform data for Ant Design Table
      const transformedData = data.map((mess, index) => ({
        key: mess._id || index,
        _id: mess._id,
        caterer_name: mess.name,
        hostel_name: mess.hostelName || "No hostel assigned",
        isAssigned: !!mess.hostelName,
      }));

      setMesses(transformedData);
      setFilteredData(transformedData);
    } catch (error) {
      console.error("Error fetching messes:", error);
      setMesses([]);
      setFilteredData([]);
    } finally {
      setLoadingMesses(false);
    }
  };

  useEffect(() => {
    fetchMesses();
  }, []);

  // Fetch available feedback windows on mount
  useEffect(() => {
    (async () => {
      setLoadingWindows(true);
      setError("");
      try {
        const res = await fetch(`${BACKEND_URL}/feedback/windows`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const text = await res.text();
        let data = [];
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("[Caterers] windows JSON parse error", e);
        }
        if (Array.isArray(data) && data.length > 0) {
          setWindows(data);
          setSelectedWindow(data[0]);
        } else {
          setWindows([]);
        }
      } catch (e) {
        console.error("[Caterers] Fetch windows error:", e);
        setWindows([]);
      } finally {
        setLoadingWindows(false);
      }
    })();
  }, [token]);

  // Fetch leaderboard when selectedWindow changes
  useEffect(() => {
    if (!selectedWindow) {
      setLeaderboardRows([]);
      return;
    }
    (async () => {
      setLoadingLeaderboard(true);
      setError("");
      try {
        const url = `${BACKEND_URL}/feedback/leaderboard-by-window?windowNumber=${selectedWindow}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const text = await res.text();
        if (!res.ok) {
          setError(`Failed to fetch leaderboard: ${res.status}`);
          setLeaderboardRows([]);
          return;
        }
        let data = [];
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("[Caterers] leaderboard JSON parse error", e);
        }
        setLeaderboardRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("[Caterers] Fetch leaderboard error:", e);
        setError(String(e.message || e));
      } finally {
        setLoadingLeaderboard(false);
      }
    })();
  }, [selectedWindow, token]);

  // Merge messes with leaderboard; default sort by rank (ascending; '-' at bottom)
  useEffect(() => {
    const map = new Map(leaderboardRows.map((r) => [r.catererId, r]));
    const enriched = messes.map((m) => {
      const r = map.get(m._id);
      if (!r) {
        return {
          ...m,
          rank: "-",
          totalUsers: 0,
          smcUsers: 0,
          avgBreakfast: null,
          avgLunch: null,
          avgDinner: null,
          avgHygiene: null,
          avgWasteDisposal: null,
          avgQualityOfIngredients: null,
          avgUniformAndPunctuality: null,
          overall: null,
        };
      }
      return {
        ...m,
        rank: r.rank ?? "-",
        totalUsers: r.totalUsers ?? 0,
        smcUsers: r.smcUsers ?? 0,
        avgBreakfast: r.avgBreakfast ?? null,
        avgLunch: r.avgLunch ?? null,
        avgDinner: r.avgDinner ?? null,
        avgHygiene: r.avgHygiene ?? null,
        avgWasteDisposal: r.avgWasteDisposal ?? null,
        avgQualityOfIngredients: r.avgQualityOfIngredients ?? null,
        avgUniformAndPunctuality: r.avgUniformAndPunctuality ?? null,
        overall: r.overall ?? null,
      };
    });

    const sortByRank = (arr) => {
      return arr.slice().sort((a, b) => {
        const ra = typeof a.rank === "number" ? a.rank : parseInt(a.rank, 10);
        const rb = typeof b.rank === "number" ? b.rank : parseInt(b.rank, 10);
        const va = isNaN(ra) ? 9999 : ra;
        const vb = isNaN(rb) ? 9999 : rb;
        return va - vb;
      });
    };

    const finalData = sortByRank(enriched);
    setFilteredData(finalData);
  }, [messes, leaderboardRows]);

  const handleRowClick = async (record) => {
    try {
      // Prefetch feedbacks (complaints) and pass via route state
      const details = await getMessById(record._id);
      const feedbacks = Array.isArray(details?.complaints)
        ? details.complaints
        : [];
      navigate(`/mess/${record._id}`, { state: { feedbacks } });
    } catch (e) {
      console.error(
        "Prefetch mess details failed, navigating without state",
        e,
      );
      navigate(`/mess/${record._id}`);
    }
  };

  const escapeHTML = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  function buildPrintableHTML(data, windowNumber) {
    const head = `
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Mess Ratings Report</title>
    <style>
      @page { size: landscape; margin: 15mm 20mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: 'Segoe UI', Roboto, Arial, Helvetica, sans-serif; 
        padding: 0; 
        color: #1f2937; 
        background: #fff;
        line-height: 1.4;
      }
      .doc-header { 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        margin-bottom: 20px;
        padding-bottom: 14px;
        border-bottom: 2px solid #1e40af;
      }
      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .title-group {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .doc-title { 
        font-size: 23px; 
        font-weight: 700; 
        color: #1e40af;
        letter-spacing: -0.025em;
      }
      .doc-subtitle { 
        color: #6b7280; 
        font-size: 12px;
        font-weight: 500;
      }
      .doc-meta { 
        text-align: right; 
        color: #6b7280; 
        font-size: 10.5px;
        line-height: 1.6;
      }
      .meta-label {
        font-weight: 600;
        color: #374151;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        font-size: 10.5px; 
        margin-top: 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      th, td { 
        border: 1px solid #d1d5db; 
        padding: 7px 9px; 
        text-align: left; 
        vertical-align: middle;
      }
      thead th { 
        background: linear-gradient(180deg, #dbeafe, #bfdbfe); 
        color: #1e40af; 
        font-weight: 700;
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.025em;
        padding: 8px 9px;
      }
      tbody tr:nth-child(odd) { background: #ffffff; }
      tbody tr:nth-child(even) { background: #f9fafb; }
      tbody tr:hover { background: #f3f4f6; }
      .center { text-align: center; }
      .rank-cell {
        font-weight: 700;
        color: #1e40af;
        font-size: 11.5px;
      }
      .caterer-cell {
        font-weight: 600;
        color: #111827;
        font-size: 10.5px;
      }
      .rating-cell {
        font-weight: 600;
        color: #059669;
        font-size: 10.5px;
      }
      .footer {
        margin-top: 16px;
        padding-top: 11px;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        font-size: 9.5px;
        color: #9ca3af;
      }
    </style>
  </head>
  <body>
    <div class="doc-header">
      <div class="header-left">
        <div class="title-group">
          <div class="doc-title">Mess Caterer Performance Report</div>
          <div class="doc-subtitle">Hostel Affairs Board | IIT Guwahati</div>
        </div>
      </div>
      <div class="doc-meta">
        <div><span class="meta-label">Generated:</span> ${new Date().toLocaleString(
          "en-IN",
          {
            dateStyle: "medium",
            timeStyle: "short",
          },
        )}</div>
        <div><span class="meta-label">Total Caterers:</span> ${
          data.length
        }</div>
        <div><span class="meta-label">Window:</span> ${
          windowNumber ? `Window ${windowNumber}` : "Latest"
        }</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:40px" class="center">Rank</th>
          <th style="width:180px">Caterer Name</th>
          <th style="width:140px">Hostel</th>
          <th style="width:70px" class="center">Feedbacks</th>
          <th style="width:70px" class="center">SMC</th>
          <th style="width:70px" class="center">Breakfast</th>
          <th style="width:70px" class="center">Lunch</th>
          <th style="width:70px" class="center">Dinner</th>
          <th style="width:70px" class="center">Hygiene</th>
          <th style="width:70px" class="center">Waste</th>
          <th style="width:70px" class="center">Quality</th>
          <th style="width:70px" class="center">Uniform</th>
          <th style="width:80px" class="center">OPI</th>
        </tr>
      </thead>
      <tbody>
  `;

    const rows = data
      .map(
        (r) => `
    <tr>
      <td class="center rank-cell">${r.rank ?? "-"}</td>
      <td class="caterer-cell">${escapeHTML(r.caterer_name ?? "-")}</td>
      <td>${escapeHTML(r.hostel_name ?? "-")}</td>
      <td class="center">${r.totalUsers ?? 0}</td>
      <td class="center">${r.smcUsers ?? 0}</td>
      <td class="center">${
        r.avgBreakfast == null ? "-" : Number(r.avgBreakfast).toFixed(2)
      }</td>
      <td class="center">${
        r.avgLunch == null ? "-" : Number(r.avgLunch).toFixed(2)
      }</td>
      <td class="center">${
        r.avgDinner == null ? "-" : Number(r.avgDinner).toFixed(2)
      }</td>
      <td class="center">${
        r.avgHygiene == null ? "-" : Number(r.avgHygiene).toFixed(2)
      }</td>
      <td class="center">${
        r.avgWasteDisposal == null ? "-" : Number(r.avgWasteDisposal).toFixed(2)
      }</td>
      <td class="center">${
        r.avgQualityOfIngredients == null
          ? "-"
          : Number(r.avgQualityOfIngredients).toFixed(2)
      }</td>
      <td class="center">${
        r.avgUniformAndPunctuality == null
          ? "-"
          : Number(r.avgUniformAndPunctuality).toFixed(2)
      }</td>
      <td class="center rating-cell">${
        r.overall == null ? "-" : Number(r.overall).toFixed(2)
      }</td>
    </tr>
  `,
      )
      .join("");

    const foot = `
    </tbody>
  </table>
  <div class="footer">
    This is an official document generated by the Hostel Affairs Board, IIT Guwahati. 
    For queries, please contact the HAB office.
  </div>
</body>
</html>
`;

    return head + rows + foot;
  }

  function normalizeHostelLabel(hostelName) {
    const trimmed = String(hostelName || "").trim();
    return trimmed || "Unknown Hostel";
  }

  function groupDetailedRowsByHostel(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const hostelName = normalizeHostelLabel(row.hostelName);
      if (!groups.has(hostelName)) {
        groups.set(hostelName, []);
      }
      groups.get(hostelName).push(row);
    });

    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }

  function sanitizePdfText(value) {
    const text = String(value ?? "");
    const normalized = text.normalize("NFKD");
    return normalized
      .replace(/[\u0300-\u036f]/g, "") // remove combining marks
      .replace(/\u00A0/g, " ") // non-breaking spaces
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width characters
      .replace(/[^\x20-\x7E\n]/g, " ") // keep printable ASCII + newline
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function drawDetailedFeedbackTable(pdf, rows, windowNumber) {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginLeft = 30;
    const marginRight = 30;
    const marginTop = 25;
    const marginBottom = 25;
    const tableWidth = pageWidth - marginLeft - marginRight;
    const cellPadding = 4;
    // Use a consistent font size throughout the table
    const fontSize = 8;
    // Line height for wrapped text rows (pt per line at fontSize 8)
    const lineHeight = 10;
    // Header row is taller to give column labels breathing room
    const headerHeight = 20;

    const colDefs = [
      { key: "sl", label: "Sl.No", width: 30, align: "center" },
      { key: "userName", label: "User Name", width: 85 },
      { key: "rollNumber", label: "Roll No.", width: 65 },
      { key: "breakfast", label: "Breakfast", width: 50, align: "center" },
      { key: "lunch", label: "Lunch", width: 50, align: "center" },
      { key: "dinner", label: "Dinner", width: 50, align: "center" },
      { key: "cleanliness", label: "Cleanliness", width: 60, align: "center" },
      { key: "waste", label: "Waste", width: 60, align: "center" },
      { key: "quality", label: "Quality", width: 60, align: "center" },
      { key: "uniform", label: "Uniform", width: 70, align: "center" },
      { key: "feedback", label: "Feedback", width: 202 },
    ];

    const totalWidth = colDefs.reduce((acc, c) => acc + c.width, 0);
    const widthScale = tableWidth / totalWidth;
    const cols = colDefs.map((c) => ({ ...c, width: c.width * widthScale }));

    // ------------------------------------------------------------------ //
    // drawHeader – draws the blue-tinted header row at position y         //
    // Fix: use pdf.setFontSize + explicit baseline "top" so text never    //
    // clips or overflows the header cell.                                 //
    // ------------------------------------------------------------------ //
    const drawHeader = (y) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(fontSize);

      let x = marginLeft;
      cols.forEach((col) => {
        // Fill: light blue gradient approximated as solid light blue
        pdf.setFillColor(219, 234, 254); // #dbeafe
        pdf.setDrawColor(147, 197, 253); // #93c5fd – slightly darker border
        pdf.rect(x, y, col.width, headerHeight, "FD");

        // Text: dark blue, vertically centered inside the header cell
        pdf.setTextColor(30, 64, 175); // #1e40af
        const label = sanitizePdfText(col.label) || "-";

        // Measure wrapped lines so we can center them vertically
        const maxLabelWidth = col.width - 2 * cellPadding;
        const lines = pdf.splitTextToSize(label, Math.max(5, maxLabelWidth));

        // Vertical center: top of text block = y + (headerHeight - block height) / 2
        const blockHeight = lines.length * lineHeight;
        const ty = y + (headerHeight - blockHeight) / 2 + lineHeight * 0.75;

        const tx = col.align === "center" ? x + col.width / 2 : x + cellPadding;

        pdf.text(lines, tx, ty, {
          align: col.align === "center" ? "center" : "left",
          baseline: "alphabetic",
        });

        x += col.width;
      });

      // Reset colors for body rows
      pdf.setTextColor(31, 41, 55); // #1f2937
      pdf.setDrawColor(209, 213, 219); // #d1d5db
      pdf.setFont("helvetica", "normal");
    };

    // ------------------------------------------------------------------ //
    // Page 2+ header banner                                               //
    // ------------------------------------------------------------------ //
    pdf.addPage();

    // Section title
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(30, 64, 175);
    pdf.text("Detailed User Feedback", marginLeft, marginTop);

    // Sub-title
    pdf.setFontSize(10);
    pdf.setTextColor(107, 114, 128);
    pdf.text(
      `Hostel Affairs Board | IIT Guwahati | ${
        windowNumber ? `Window ${windowNumber}` : "Latest Window"
      }`,
      marginLeft,
      marginTop + 14,
    );

    let y = marginTop + 28;

    drawHeader(y);
    y += headerHeight;

    // ------------------------------------------------------------------ //
    // Empty-state guard                                                   //
    // ------------------------------------------------------------------ //
    if (!rows.length) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(fontSize);
      pdf.setTextColor(107, 114, 128);
      pdf.text(
        "No feedback entries found for this window.",
        marginLeft,
        y + 16,
      );
      return;
    }

    // ------------------------------------------------------------------ //
    // Body rows                                                           //
    // ------------------------------------------------------------------ //
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(31, 41, 55);
    pdf.setDrawColor(209, 213, 219);

    const groupedRows = groupDetailedRowsByHostel(rows);
    let serial = 1;
    // Track even/odd for alternating row shading
    let rowIndex = 0;

    const ensureSpace = (requiredHeight) => {
      if (y + requiredHeight > pageHeight - marginBottom) {
        pdf.addPage();
        y = marginTop;
        drawHeader(y);
        y += headerHeight;
        // Reset body styles after re-drawing header
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(fontSize);
        pdf.setTextColor(31, 41, 55);
        pdf.setDrawColor(209, 213, 219);
      }
    };

    groupedRows.forEach(([hostelName, hostelRows]) => {
      // ---- Hostel separator row ----------------------------------------
      ensureSpace(16);
      pdf.setFillColor(229, 231, 235); // #e5e7eb — light grey banner
      pdf.setDrawColor(156, 163, 175); // #9ca3af
      pdf.rect(marginLeft, y, tableWidth, 14, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(17, 24, 39); // #111827
      pdf.text(`Hostel: ${hostelName}`, marginLeft + cellPadding, y + 9.5);
      y += 14;

      // ---- Data rows ---------------------------------------------------
      hostelRows.forEach((row) => {
        const smc = row.smcFields || {};
        const rowData = {
          sl: String(serial),
          userName: sanitizePdfText(row.userName || "-") || "-",
          rollNumber: sanitizePdfText(row.rollNumber || "-") || "-",
          breakfast: sanitizePdfText(row.breakfast || "-") || "-",
          lunch: sanitizePdfText(row.lunch || "-") || "-",
          dinner: sanitizePdfText(row.dinner || "-") || "-",
          cleanliness: sanitizePdfText(smc.cleanliness || "-") || "-",
          waste: sanitizePdfText(smc.wasteDisposal || "-") || "-",
          quality: sanitizePdfText(smc.qualityOfIngredients || "-") || "-",
          uniform: sanitizePdfText(smc.uniformAndPunctuality || "-") || "-",
          feedback: sanitizePdfText(row.comment || "-") || "-",
        };

        // Pre-wrap all cells so we know the row height before drawing
        const wrapped = cols.map((col) =>
          pdf.splitTextToSize(
            rowData[col.key],
            Math.max(5, col.width - 2 * cellPadding),
          ),
        );
        const maxLines = wrapped.reduce(
          (m, lines) => Math.max(m, lines.length),
          1,
        );
        const rowHeight = Math.max(14, maxLines * lineHeight + 2 * cellPadding);

        ensureSpace(rowHeight);

        // Draw each cell individually so fill+stroke colours are set
        // fresh per cell — prevents any prior setFillColor from bleeding in.
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(fontSize);
        pdf.setTextColor(31, 41, 55); // #1f2937
        pdf.setDrawColor(209, 213, 219); // #d1d5db

        // Alternating row background colour
        const rowFill =
          rowIndex % 2 === 0
            ? [255, 255, 255] // white
            : [249, 250, 251]; // #f9fafb

        let x = marginLeft;
        cols.forEach((col, idx) => {
          // Always reset fill before every rect so nothing bleeds
          pdf.setFillColor(rowFill[0], rowFill[1], rowFill[2]);
          pdf.rect(x, y, col.width, rowHeight, "FD");

          const textLines = wrapped[idx];
          const tx =
            col.align === "center" ? x + col.width / 2 : x + cellPadding;
          const ty = y + cellPadding + lineHeight * 0.75;

          pdf.setTextColor(31, 41, 55); // re-assert text colour after rect
          pdf.text(textLines, tx, ty, {
            align: col.align === "center" ? "center" : "left",
            baseline: "alphabetic",
          });
          x += col.width;
        });

        y += rowHeight;
        serial += 1;
        rowIndex += 1;
      });
    });
  }

  async function renderHTMLToCanvas(html, width = 1400) {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = `${width}px`;
    container.style.background = "white";
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      return await html2canvas(container, {
        scale: 2,
        useCORS: false,
        allowTaint: false,
        backgroundColor: "#ffffff",
      });
    } finally {
      container.remove();
    }
  }

  function addCanvasToPdfWithPagination(pdf, canvas) {
    // JPEG avoids intermittent PNG signature parser errors in jsPDF for large canvases.
    const imgData = canvas.toDataURL("image/jpeg", 1.0);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const marginLeft = 30;
    const marginTop = 25;
    const marginRight = 30;
    const marginBottom = 25;
    const usableWidth = pdfWidth - marginLeft - marginRight;
    const usableHeight = pdfHeight - marginTop - marginBottom;

    const scaledWidth = usableWidth;
    const scaledHeight = (canvas.height * scaledWidth) / canvas.width;

    let renderedHeight = 0;
    let pageIndex = 0;

    while (renderedHeight < scaledHeight) {
      if (pageIndex > 0) {
        pdf.addPage();
      }
      pdf.addImage(
        imgData,
        "JPEG",
        marginLeft,
        marginTop - renderedHeight,
        scaledWidth,
        scaledHeight,
      );
      renderedHeight += usableHeight;
      pageIndex += 1;
    }
  }

  async function fetchDetailedFeedback(windowNumber) {
    const url = `${BACKEND_URL}/feedback/detailed-by-window?windowNumber=${windowNumber}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to fetch detailed feedback (${res.status})`);
    }
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  }

  async function handleDownloadPDF(data) {
    try {
      setGeneratingPDF(true);
      const windowForReport = selectedWindow || windows[0] || "";
      const [summaryCanvas, detailedRows] = await Promise.all([
        renderHTMLToCanvas(buildPrintableHTML(data, windowForReport), 1400),
        windowForReport ? fetchDetailedFeedback(windowForReport) : [],
      ]);
      const catererToHostel = new Map(
        filteredData.map((item) => [
          String(item.caterer_name || "")
            .trim()
            .toLowerCase(),
          item.hostel_name || "-",
        ]),
      );
      const detailedRowsWithHostel = detailedRows.map((row) => {
        const existingHostel = String(row?.hostelName || "").trim();
        if (existingHostel) {
          return row;
        }
        const key = String(row?.catererName || "")
          .trim()
          .toLowerCase();
        return { ...row, hostelName: catererToHostel.get(key) || "-" };
      });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      addCanvasToPdfWithPagination(pdf, summaryCanvas);
      drawDetailedFeedbackTable(pdf, detailedRowsWithHostel, windowForReport);
      pdf.save(
        `mess-ratings-window-${windowForReport || "latest"}-detailed.pdf`,
      );
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingPDF(false);
    }
  }

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "#f5f5f5",
        minHeight: "100vh",
      }}
    >
      {generatingPDF && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255,255,255,0.85)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: "#374151" }}>
              Preparing PDF...
            </div>
          </div>
        </div>
      )}
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header card restored with white background and subtle border to match other frontends */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#fff",
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            marginBottom: "24px",
          }}
        >
          <Title level={2} style={{ margin: 0 }}>
            Caterers
          </Title>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => navigate("/create-mess")}
            >
              Add Caterer
            </Button>
            {/* Icon-only download button: opens printable landscape view of the full rating table */}
            <Button
              type="default"
              shape="circle"
              icon={<DownloadOutlined />}
              size="large"
              title="Download ratings as PDF"
              onClick={() => handleDownloadPDF(filteredData)}
            />
          </Space>
        </div>

        {/* Table */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <span style={{ color: "#8c8c8c", fontSize: 14 }}>
              Total: {filteredData.length} caterer
              {filteredData.length !== 1 ? "s" : ""}
            </span>
            <Space>
              {windows.length > 0 && (
                <Select
                  value={selectedWindow}
                  size="middle"
                  onChange={(val) => setSelectedWindow(val)}
                  style={{ width: 160 }}
                  options={windows.map((w) => ({
                    value: w,
                    label: `Window ${w}`,
                  }))}
                />
              )}
            </Space>
          </div>

          {/* Compact columns to reduce visual congestion. Full metrics are available in expanded row. */}
          <Table
            columns={compactColumns}
            dataSource={filteredData}
            loading={loadingMesses || loadingWindows || loadingLeaderboard}
            pagination={false}
            size="middle"
            expandable={{
              expandedRowRender: (record) => (
                <div style={{ padding: 12 }}>
                  {/* Top row: 3 main metrics centered */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div style={{ display: "flex", gap: 24 }}>
                      <div style={{ minWidth: 160 }}>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Avg Breakfast
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {record.avgBreakfast == null
                            ? "-"
                            : Number(record.avgBreakfast).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ minWidth: 160 }}>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Avg Lunch
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {record.avgLunch == null
                            ? "-"
                            : Number(record.avgLunch).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ minWidth: 160 }}>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Avg Dinner
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {record.avgDinner == null
                            ? "-"
                            : Number(record.avgDinner).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 12 }} />

                  {/* Bottom row: 4 SMC metrics centered */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div style={{ display: "flex", gap: 24 }}>
                      <div style={{ minWidth: 160 }}>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Avg Hygiene (SMC)
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {record.avgHygiene == null
                            ? "-"
                            : Number(record.avgHygiene).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ minWidth: 160 }}>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Avg Waste (SMC)
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {record.avgWasteDisposal == null
                            ? "-"
                            : Number(record.avgWasteDisposal).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ minWidth: 160 }}>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Avg Quality (SMC)
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {record.avgQualityOfIngredients == null
                            ? "-"
                            : Number(record.avgQualityOfIngredients).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ minWidth: 160 }}>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Avg Uniform (SMC)
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {record.avgUniformAndPunctuality == null
                            ? "-"
                            : Number(record.avgUniformAndPunctuality).toFixed(
                                2,
                              )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ),
              rowExpandable: () => true,
            }}
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              style: { cursor: "pointer" },
            })}
            locale={{ emptyText: "No caterers found." }}
            style={{
              marginTop: "16px",
            }}
            rowClassName={() => "hover:bg-gray-50"}
          />
        </div>

        <FeedbackControl />
      </div>
    </div>
  );
}

// Compact columns definition (kept outside JSX to avoid parser issues)
const compactColumns = [
  {
    title: "Rank",
    dataIndex: "rank",
    key: "rank",
    width: 70,
  },
  {
    title: "Caterer",
    dataIndex: "caterer_name",
    key: "caterer_name",
    render: (text, record) => (
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{text}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {record.hostel_name}
        </div>
      </div>
    ),
    width: 300,
  },
  {
    title: "Feedbacks",
    dataIndex: "totalUsers",
    key: "totalUsers",
    width: 120,
    render: (v) => (v == null ? 0 : v),
  },
  {
    title: "SMC Members",
    dataIndex: "smcUsers",
    key: "smcUsers",
    width: 120,
    render: (v) => (v == null ? 0 : v),
  },
  {
    title: "OPI Rating",
    dataIndex: "overall",
    key: "overall",
    width: 100,
    render: (v) => (v == null ? "-" : Number(v).toFixed(2)),
  },
];

// per-row download removed; printing is available via header download button which prints the full table
