import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../apis";

const MessBillCalculator = ({ hostelId, hostelName }) => {
  // Generate available months (before current month, excluding current month)
  const getAvailableMonths = () => {
    const months = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Get past 12 months (excluding current month)
    for (let i = 11; i >= 1; i--) {
      let month = currentMonth - i;
      let year = currentYear;

      if (month < 0) {
        month += 12;
        year -= 1;
      }

      months.push({ year, month });
    }

    return months.reverse();
  };

  const availableMonths = getAvailableMonths();
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(
    availableMonths.length > 0 ? 0 : null
  );

  const selectedMonthData = 
    selectedMonthIndex !== null ? availableMonths[selectedMonthIndex] : null;
  const selectedMonth = selectedMonthData?.month ?? new Date().getMonth();
  const selectedYear = selectedMonthData?.year ?? new Date().getFullYear();

  const [billData, setBillData] = useState({
    month: new Date().toLocaleString("default", { month: "long" }),
    year: new Date().getFullYear(),
    hostelName: hostelName || "",
    accountNumber: "",
    operatingDays: 30, // Hardcoded as per requirement
    shutdownDate: "NA",
    totalSubscribers: 0,
    messDays: 0,
    rebateDays: 0,
    consumingDays: 0,
    foodCost: 0,
    totalWage: 0,
    messBillClaimed: 0,
    messBill: 0,
    gstAmount: 0,
    tdsAmount: 0,
    firstInstallment: 0,
    secondInstallment: 0,
    rebateReimbursement: 0,
    miscDeduction: 0,
    habTransfer: 0,
    totalExpenditure: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Update month and year when selection changes
  useEffect(() => {
    const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString(
      "default",
      { month: "long" }
    );
    setBillData((prev) => ({
      ...prev,
      month: monthName,
      year: selectedYear,
    }));
  }, [selectedMonthIndex]);

  // Fetch users subscribed to this hostel's mess
  const fetchMessSubscribers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/hostel/mess-subscribers`
      );

      setBillData((prev) => ({
        ...prev,
        totalSubscribers: response.data.count || 0,
        messDays: (response.data.count || 0) * 30, // M = N * D
      }));
    } catch (err) {
      setError("Failed to fetch mess subscribers: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hostelId) {
      fetchMessSubscribers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostelId, selectedMonthIndex]);

  // Calculate all derived values when inputs change
  useEffect(() => {
    const { messDays, rebateDays, totalWage, miscDeduction } = billData;

    const consumingDays = messDays - rebateDays; // T1 = M - R
    const foodCost = consumingDays * 119; // F = T1 * 119
    const messBill = foodCost + totalWage; // F + W
    const messBillClaimed = 1.05 * messBill; // B = 1.05 * (F + W)
    const gstAmount = 0.05 * messBill; // GST = 5% * (F + W)
    const tdsAmount = 0.02 * messBill; // T2 = 0.02 * (F + W)
    const firstInstallment =
      messBillClaimed - (tdsAmount + 0.2 * foodCost) - miscDeduction; // P1 = B - (T2 + (0.2*F)) - Misc
    const secondInstallment = 0.2 * foodCost; // P2 = 0.2 * F
    const rebateReimbursement = rebateDays * 119; // RR = R * 119
    const habTransfer =
      firstInstallment + secondInstallment + rebateReimbursement; // T3 = P1 + P2 + RR
    const totalExpenditure = tdsAmount + habTransfer; // T2 + T3

    setBillData((prev) => ({
      ...prev,
      consumingDays,
      foodCost,
      messBill,
      messBillClaimed,
      gstAmount,
      tdsAmount,
      firstInstallment,
      secondInstallment,
      rebateReimbursement,
      habTransfer,
      totalExpenditure,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    billData.messDays,
    billData.rebateDays,
    billData.totalWage,
    billData.miscDeduction,
  ]);

  const handleInputChange = (field, value) => {
    setBillData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const downloadBillAsPDF = () => {
    // Create a new window for PDF printing
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mess Bill - ${billData.hostelName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .formula { font-style: italic; color: #666; }
            .value { font-weight: bold; }
            .verification { margin-top: 30px; font-style: italic; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">MESS BILL CALCULATION FOR ${billData.month.toUpperCase()} ${
      billData.year
    }</div>
          
          <table>
            <tr>
              <th>Description</th>
              <th>Formula</th>
              <th>Value</th>
              <th>Notes</th>
            </tr>
            <tr>
              <td>Month and Year</td>
              <td></td>
              <td class="value">${billData.month}, ${billData.year}</td>
              <td></td>
            </tr>
            <tr>
              <td>Hostel Name</td>
              <td></td>
              <td class="value">${billData.hostelName}</td>
              <td></td>
            </tr>
            <tr>
              <td>Hostel Mess Account Number (Canara Bank)</td>
              <td></td>
              <td class="value">${billData.accountNumber}</td>
              <td></td>
            </tr>
            <tr>
              <td>No of mess operating Days</td>
              <td class="formula">D</td>
              <td class="value">${billData.operatingDays}</td>
              <td></td>
            </tr>
            <tr>
              <td>Mess Shutdown Date</td>
              <td></td>
              <td class="value">${billData.shutdownDate}</td>
              <td></td>
            </tr>
            <tr>
              <td>Total No of mess subscribers</td>
              <td class="formula">N</td>
              <td class="value">${billData.totalSubscribers}</td>
              <td>Auto-populated from database</td>
            </tr>
            <tr>
              <td>No of Mess Days (Actual days)</td>
              <td class="formula">M = N × D</td>
              <td class="value">${billData.messDays}</td>
              <td></td>
            </tr>
            <tr>
              <td>Total Rebate Days</td>
              <td class="formula">R</td>
              <td class="value">${billData.rebateDays}</td>
              <td>Manual entry</td>
            </tr>
            <tr>
              <td>Total no of consuming Days</td>
              <td class="formula">T1 = M - R</td>
              <td class="value">${billData.consumingDays}</td>
              <td></td>
            </tr>
            <tr>
              <td>Food Cost</td>
              <td class="formula">F = T1 × 119</td>
              <td class="value">${formatCurrency(billData.foodCost)}</td>
              <td></td>
            </tr>
            <tr>
              <td>Total Wage</td>
              <td class="formula">W</td>
              <td class="value">${formatCurrency(billData.totalWage)}</td>
              <td>Manual entry</td>
            </tr>
            <tr>
              <td>Mess Bill (Claimed by caterer)</td>
              <td class="formula">B = 1.05 × (F + W)</td>
              <td class="value">${formatCurrency(billData.messBillClaimed)}</td>
              <td></td>
            </tr>
            <tr>
              <td>Mess Bill</td>
              <td class="formula">F + W</td>
              <td class="value">${formatCurrency(billData.messBill)}</td>
              <td></td>
            </tr>
            <tr>
              <td>GST Amount, 5%</td>
              <td class="formula">GST = 5% × (F + W)</td>
              <td class="value">${formatCurrency(billData.gstAmount)}</td>
              <td></td>
            </tr>
            <tr>
              <td>TDS Amount</td>
              <td class="formula">T2 = 0.02 × (F + W)</td>
              <td class="value">${formatCurrency(billData.tdsAmount)}</td>
              <td></td>
            </tr>
            <tr>
              <td>First Installment of Payment from hostel office to the caterer</td>
              <td class="formula">P1 = B - (T2 + (0.2×F)) - Misc</td>
              <td class="value">${formatCurrency(
                billData.firstInstallment
              )}</td>
              <td></td>
            </tr>
            <tr>
              <td>Second Installment of Payment from hostel office to the caterer</td>
              <td class="formula">P2 = 0.2 × F</td>
              <td class="value">${formatCurrency(
                billData.secondInstallment
              )}</td>
              <td></td>
            </tr>
            <tr>
              <td>Rebate Reimbursement (hostel office should release to the student)</td>
              <td class="formula">RR = R × 119</td>
              <td class="value">${formatCurrency(
                billData.rebateReimbursement
              )}</td>
              <td></td>
            </tr>
            <tr>
              <td>Misc deduction</td>
              <td class="formula">Misc</td>
              <td class="value">${formatCurrency(billData.miscDeduction)}</td>
              <td>Manual entry</td>
            </tr>
            <tr>
              <td>HAB Transfer to hostel offices</td>
              <td class="formula">T3 = P1 + P2 + RR</td>
              <td class="value">${formatCurrency(billData.habTransfer)}</td>
              <td></td>
            </tr>
            <tr>
              <td>Total Mess bill Expenditure (For HAB Office Use Only)</td>
              <td class="formula">T2 + T3</td>
              <td class="value">${formatCurrency(
                billData.totalExpenditure
              )}</td>
              <td></td>
            </tr>
          </table>
          
          <div class="verification">
            Above data has been verified and found to be true and correct.
          </div>
          
          <div class="no-print" style="margin-top: 20px;">
            <button onclick="window.print()">Print PDF</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return <div className="p-4 text-center">Loading mess subscribers...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        Mess Bill Calculation Sheet
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Month Selection Dropdown */}
      <div className="mb-6 flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Month:</label>
        <select
          value={selectedMonthIndex ?? ""}
          onChange={(e) => setSelectedMonthIndex(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">-- Select Month --</option>
          {availableMonths.map((item, idx) => {
            const monthName = new Date(item.year, item.month, 1).toLocaleString(
              "default",
              { month: "long" }
            );
            return (
              <option key={idx} value={idx}>
                {monthName} {item.year}
              </option>
            );
          })}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">
            General Information
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Month and Year
            </label>
            <input
              type="text"
              value={`${billData.month}, ${billData.year}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">
              Selected from month picker above
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hostel Name
            </label>
            <input
              type="text"
              value={billData.hostelName}
              onChange={(e) => handleInputChange("hostelName", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hostel Mess Account Number (Canara Bank)
            </label>
            <input
              type="text"
              value={billData.accountNumber}
              onChange={(e) =>
                handleInputChange("accountNumber", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter account number"
            />
          </div>
        </div>

        {/* Input Parameters */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">
            Input Parameters
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              No of mess operating Days (D)
            </label>
            <input
              type="number"
              value={billData.operatingDays}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">Hardcoded to 30</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total No of mess subscribers (N)
            </label>
            <input
              type="number"
              value={billData.totalSubscribers}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">
              Auto-populated from database
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              No of Mess Days (M = N × D)
            </label>
            <input
              type="number"
              value={billData.messDays}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Rebate Days (R)
            </label>
            <input
              type="number"
              value={billData.rebateDays}
              onChange={(e) =>
                handleInputChange("rebateDays", parseFloat(e.target.value) || 0)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter rebate days"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Wage (W)
            </label>
            <input
              type="number"
              value={billData.totalWage}
              onChange={(e) =>
                handleInputChange("totalWage", parseFloat(e.target.value) || 0)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter total wage"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Misc deduction
            </label>
            <input
              type="number"
              value={billData.miscDeduction}
              onChange={(e) =>
                handleInputChange(
                  "miscDeduction",
                  parseFloat(e.target.value) || 0
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter misc deduction"
            />
          </div>
        </div>
      </div>

      {/* Bill Calculation Table */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4">
          Mess Bill Calculation Table
        </h3>

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                  Description
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                  Formula
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                  Value
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">
                  Month and Year
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600"></td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {billData.month}, {billData.year}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500"></td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  Hostel Name
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600"></td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {billData.hostelName}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500"></td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">
                  Hostel Mess Account Number (Canara Bank)
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600"></td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {billData.accountNumber}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500"></td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  No of mess operating Days
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  D
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {billData.operatingDays}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Hardcoded
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">
                  Mess Shutdown Date
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600"></td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {billData.shutdownDate}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500"></td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  Total No of mess subscribers
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  N
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {billData.totalSubscribers}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Auto-populated from database
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">
                  No of Mess Days (Actual days)
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  M = N × D
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {billData.messDays}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  Total Rebate Days
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  R
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {billData.rebateDays}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Manual entry
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">
                  Total no of consuming Days
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  T1 = M - R
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {billData.consumingDays}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">Food Cost</td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  F = T1 × 119
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.foodCost)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Total Wage</td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  W
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.totalWage)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Manual entry
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  Mess Bill (Claimed by caterer)
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  B = 1.05 × (F + W)
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.messBillClaimed)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Mess Bill</td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  F + W
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.messBill)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  GST Amount, 5%
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  GST = 5% × (F + W)
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.gstAmount)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">TDS Amount</td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  T2 = 0.02 × (F + W)
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.tdsAmount)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  First Installment of Payment from hostel office to the caterer
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  P1 = B - (T2 + (0.2×F)) - Misc
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.firstInstallment)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">
                  Second Installment of Payment from hostel office to the
                  caterer
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  P2 = 0.2 × F
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.secondInstallment)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  Rebate Reimbursement (hostel office should release to the
                  student)
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  RR = R × 119
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.rebateReimbursement)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">
                  Misc deduction
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  Misc
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.miscDeduction)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Manual entry
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  HAB Transfer to hostel offices
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  T3 = P1 + P2 + RR
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.habTransfer)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated
                </td>
              </tr>
              <tr className="bg-blue-100">
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  Total Mess bill Expenditure (For HAB Office Use Only)
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic font-semibold">
                  T2 + T3
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold text-blue-800">
                  {formatCurrency(billData.totalExpenditure)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Final Total
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={downloadBillAsPDF}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md shadow-md font-medium"
        >
          Download PDF
        </button>
      </div>

      {/* Verification Note */}
      <div className="mt-6 p-4 bg-gray-100 rounded-lg">
        <p className="text-sm text-gray-700 italic">
          Above data has been verified and found to be true and correct.
        </p>
      </div>
    </div>
  );
};

export default MessBillCalculator;
