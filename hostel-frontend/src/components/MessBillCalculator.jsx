import React, { useState, useEffect } from "react";
import { message } from "antd";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { getMessSubscribers } from "../apis/hostelApi";
import { getMessWorkers, generateMessBill, fetchMessBill, getRebateSummary } from "../apis/messApi";

const MySwal = withReactContent(Swal);

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
    totalSubscribersOffset: 0,
    messDays: 0,
    rebateDays: 0,
    rebateDaysOffset: 0,
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
  const [workers, setWorkers] = useState([]);
  const [workerAttendances, setWorkerAttendances] = useState({});
  const [isGenerated, setIsGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Consistent disabled style for fields locked after bill generation
  const lockedClass = isGenerated ? 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-70 border-gray-300' : '';

  const handleAttendanceChange = (workerId, value) => {
    if (isGenerated) return;
    if (value === "") {
      setWorkerAttendances(prev => ({ ...prev, [workerId]: "" }));
      return;
    }
    let days = parseFloat(value);
    if (isNaN(days)) days = 0;
    days = Math.max(0, Math.min(31, days));
    setWorkerAttendances(prev => ({
      ...prev,
      [workerId]: days
    }));
  };

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

  const checkBillStatus = async () => {
    try {
      if (!hostelId) return;
      const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString("default", { month: "long" });
      const existingBill = await fetchMessBill(hostelId, monthName, selectedYear);
      if (existingBill) {
        setIsGenerated(true);
        setBillData(prev => ({
          ...prev,
          hostelName: existingBill.hostelName ?? prev.hostelName,
          accountNumber: existingBill.accountNumber ?? prev.accountNumber,
          operatingDays: existingBill.operatingDays ?? prev.operatingDays,
          shutdownDate: existingBill.shutdownDate ?? prev.shutdownDate,
          totalSubscribersOffset: existingBill.totalSubscribersOffset ?? 0,
          rebateDays: existingBill.rebateDays ?? prev.rebateDays,
          rebateDaysOffset: existingBill.rebateDaysOffset ?? 0,
          miscDeduction: existingBill.miscDeduction ?? 0,
        }));
        if (existingBill.workerAttendances) {
          setWorkerAttendances(existingBill.workerAttendances);
        }
      } else {
        setIsGenerated(false);
        setBillData(prev => ({
          ...prev,
          totalSubscribersOffset: 0,
          rebateDaysOffset: 0,
          miscDeduction: 0,
        }));
        setWorkerAttendances(prev => {
          const reset = {};
          Object.keys(prev).forEach(id => reset[id] = 26);
          return reset;
        });
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setIsGenerated(false);
        setBillData(prev => ({
          ...prev,
          totalSubscribersOffset: 0,
          rebateDaysOffset: 0,
          miscDeduction: 0,
        }));
        setWorkerAttendances(prev => {
          const reset = {};
          Object.keys(prev).forEach(id => reset[id] = 26);
          return reset;
        });
      } else {
        console.error("Failed to check bill status:", err);
      }
    }
  };

  // Fetch users subscribed to this hostel's mess and mess workers
  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const fetchMonth = selectedMonth + 1;
      const fetchYear = selectedYear;

      const [subscribersData, workersData, rebateData] = await Promise.all([
        getMessSubscribers(),
        getMessWorkers(),
        getRebateSummary(fetchMonth, fetchYear).catch(err => {
          console.error("Failed to fetch rebate summary:", err);
          return { rebateSummary: { totalRebateDays: 0 } };
        })
      ]);

      const initialAttendances = {};
      workersData.forEach(w => {
        initialAttendances[w._id] = 26;
      });
      setWorkerAttendances(initialAttendances);
      setWorkers(workersData);

      setBillData((prev) => ({
        ...prev,
        totalSubscribers: subscribersData.length || 0,
        rebateDays: rebateData?.rebateSummary?.totalRebateDays || 0,
      }));

      await checkBillStatus();
    } catch (err) {
      setError("Failed to fetch data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hostelId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostelId, selectedMonthIndex]);

  // Update total wages when workers or attendance change
  useEffect(() => {
    const totalWageCalc = workers.reduce((sum, worker) => {
      let days = workerAttendances[worker._id] !== undefined ? workerAttendances[worker._id] : 26;
      days = Number(days) || 0;
      return sum + ((worker.rate || 0) * days);
    }, 0);
    setBillData((prev) => ({
      ...prev,
      totalWage: totalWageCalc,
    }));
  }, [workers, workerAttendances]);

  // Calculate all derived values when inputs change
  useEffect(() => {
    const { totalSubscribers, totalSubscribersOffset, rebateDays, rebateDaysOffset, operatingDays, totalWage, miscDeduction } = billData;

    const effectiveSubscribers = (Number(totalSubscribers) || 0) + (Number(totalSubscribersOffset) || 0);
    const messDays = effectiveSubscribers * (Number(operatingDays) || 0);
    const effectiveRebateDays = (Number(rebateDays) || 0) + (Number(rebateDaysOffset) || 0);

    const consumingDays = messDays - effectiveRebateDays; // T1 = M - R
    const foodCost = consumingDays * 119; // F = T1 * 119
    const messBill = foodCost + (Number(totalWage) || 0); // F + W
    const messBillClaimed = 1.05 * messBill; // B = 1.05 * (F + W)
    const gstAmount = 0.05 * messBill; // GST = 5% * (F + W)
    const tdsAmount = 0.02 * messBill; // T2 = 0.02 * (F + W)
    const firstInstallment =
      messBillClaimed - (tdsAmount + 0.2 * foodCost) - (Number(miscDeduction) || 0); // P1 = B - (T2 + (0.2*F)) - Misc
    const secondInstallment = 0.2 * foodCost; // P2 = 0.2 * F
    const rebateReimbursement = effectiveRebateDays * 119; // RR = R * 119
    const habTransfer =
      firstInstallment + secondInstallment + rebateReimbursement; // T3 = P1 + P2 + RR
    const totalExpenditure = tdsAmount + habTransfer; // T2 + T3

    setBillData((prev) => ({
      ...prev,
      messDays,
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
    billData.totalSubscribers,
    billData.totalSubscribersOffset,
    billData.rebateDays,
    billData.rebateDaysOffset,
    billData.operatingDays,
    billData.totalWage,
    billData.miscDeduction,
  ]);

  const handleInputChange = (field, value) => {
    if (isGenerated) return;
    setBillData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGenerateBill = async () => {
    if (!hostelId) {
      setError("Hostel ID is missing");
      return;
    }

    const confirmResult = await MySwal.fire({
      title: "Confirm Generation",
      html: "<p class='text-sm text-gray-600 mt-2'>Please recheck all the values. Note that once computed, <b>this action cannot be undone</b>.</p>",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#d1d5db",
      cancelButtonText: "<span class='text-gray-800 font-medium'>Cancel</span>",
      confirmButtonText: "Yes, Generate",
      reverseButtons: true,
      customClass: {
        popup: 'rounded-2xl shadow-2xl pb-6',
        title: 'text-xl font-bold text-gray-800 pt-2',
        confirmButton: 'px-6 py-2.5 rounded-lg font-medium shadow-md transition-all',
        cancelButton: 'px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all text-gray-800 hover:bg-gray-200'
      }
    });

    if (!confirmResult.isConfirmed) {
      return;
    }

    try {
      setIsGenerating(true);
      setError("");

      // Clean offset strings back to numbers to prevent Mongoose CastError on empty strings
      const payloadBillData = { 
        ...billData,
        totalSubscribersOffset: Number(billData.totalSubscribersOffset) || 0,
        rebateDaysOffset: Number(billData.rebateDaysOffset) || 0,
        miscDeduction: Number(billData.miscDeduction) || 0,
        workerAttendances
      };

      console.log("Sending generate mess bill request...", payloadBillData);
      await generateMessBill(payloadBillData, hostelId);
      setIsGenerated(true);
      message.success("Bill generated successfully!");
    } catch (err) {
      console.error("Failed to generate bill:", err);
      setError(err.response?.data?.message || err.message || "Failed to generate bill");
    } finally {
      setIsGenerating(false);
    }
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
          <div class="header">MESS BILL CALCULATION FOR ${billData.month.toUpperCase()} ${billData.year
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
              <td class="value">${(Number(billData.totalSubscribers) || 0) + (Number(billData.totalSubscribersOffset) || 0)}</td>
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
              <td class="value">${(Number(billData.rebateDays) || 0) + (Number(billData.rebateDaysOffset) || 0)}</td>
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
              <td class="formula">W = Σ(Rate × Attendance)</td>
              <td class="value">${formatCurrency(billData.totalWage)}</td>
              <td>Calculated automatically</td>
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
              <td>R × 119</td>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Side: General Info & Input Parameters (Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* General Information Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              General Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month and Year</label>
                <input type="text" value={`${billData.month}, ${billData.year}`} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none" readOnly />
                <p className="text-xs text-gray-500 mt-1">Selected from month picker above</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hostel Name</label>
                <input type="text" value={billData.hostelName} onChange={(e) => handleInputChange("hostelName", e.target.value)} disabled={isGenerated} className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isGenerated ? lockedClass : 'border-gray-300'}`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Hostel Mess Account Number (Canara Bank)</label>
                <input type="text" value={billData.accountNumber} onChange={(e) => handleInputChange("accountNumber", e.target.value)} disabled={isGenerated} className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isGenerated ? lockedClass : 'border-gray-300'}`} placeholder="Enter account number" />
              </div>
            </div>
          </div>

          {/* Input Parameters Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              Input Parameters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No of mess operating Days (D)</label>
                <input type="number" value={billData.operatingDays} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none" readOnly />
                <p className="text-xs text-gray-500 mt-1">Hardcoded to 30</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total No of mess subscribers (N)</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input type="number" value={billData.totalSubscribers} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none text-sm" readOnly />
                    <p className="text-[10px] text-gray-500 mt-1">Auto-populated</p>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={billData.totalSubscribersOffset}
                      onChange={(e) => handleInputChange("totalSubscribersOffset", e.target.value)}
                      disabled={isGenerated}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${isGenerated ? lockedClass : 'border-blue-300'}`}
                      placeholder="Offset"
                    />
                    <p className="text-[10px] text-blue-600 mt-1">Manual Offset</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No of Mess Days (M = N × D)</label>
                <input type="number" value={billData.messDays} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none" readOnly />
                <p className="text-[10px] text-gray-500 mt-1">Effective N = {(Number(billData.totalSubscribers) || 0) + (Number(billData.totalSubscribersOffset) || 0)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Rebate Days (R)</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input type="number" value={billData.rebateDays} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none text-sm" readOnly />
                    <p className="text-[10px] text-gray-500 mt-1">From API</p>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={billData.rebateDaysOffset}
                      onChange={(e) => handleInputChange("rebateDaysOffset", e.target.value)}
                      disabled={isGenerated}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${isGenerated ? lockedClass : 'border-blue-300'}`}
                      placeholder="Offset"
                    />
                    <p className="text-[10px] text-blue-600 mt-1">Manual Offset</p>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Misc deduction</label>
                <input type="number" value={billData.miscDeduction} disabled={isGenerated} onChange={(e) => handleInputChange("miscDeduction", e.target.value)} className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isGenerated ? lockedClass : 'border-gray-300'}`} placeholder="Enter misc deduction" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Manage Worker Attendance & Total Wage (Span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col h-full min-h-[400px]">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              Manage Worker Attendance
            </h3>

            <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2 overflow-y-auto space-y-2 mb-4 shadow-inner max-h-[350px]">
              {workers.length === 0 ? (
                <p className="text-xs text-center text-gray-400 italic py-4">No workers found.</p>
              ) : (
                workers.map(worker => (
                  <div key={worker._id} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col overflow-hidden mr-2">
                      <span className="text-sm font-semibold text-gray-800 truncate">{worker.name}</span>
                      <span className="text-[10px] text-gray-500 truncate">{worker.designation} - ₹{worker.rate}/day</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="31"
                        disabled={isGenerated}
                        value={workerAttendances[worker._id] ?? 26}
                        onChange={(e) => handleAttendanceChange(worker._id, e.target.value)}
                        className={`w-14 px-1 py-1 border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium ${isGenerated ? lockedClass : 'border-gray-300'}`}
                      />
                      <span className="text-[10px] text-gray-500 font-medium">days</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Wage Pinned at Bottom */}
            <div className="mt-auto pt-4 border-t border-gray-200 shrink-0">
              <label className="block text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide">
                Total Mess Wage (W)
              </label>
              <div className="w-full text-center px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800 text-2xl font-black shadow-sm">
                {formatCurrency(billData.totalWage)}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center font-medium opacity-80">Auto-computed: Σ(Rate × Attendance)</p>
            </div>
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
                  {(Number(billData.totalSubscribers) || 0) + (Number(billData.totalSubscribersOffset) || 0)}
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
                  {(Number(billData.rebateDays) || 0) + (Number(billData.rebateDaysOffset) || 0)}
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
                  W = Σ(Rate × Attendance)
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  {formatCurrency(billData.totalWage)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">
                  Calculated automatically
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
      <div className="mt-8 flex justify-center gap-4">
        {!isGenerated && (
          <button
            onClick={handleGenerateBill}
            disabled={isGenerating || loading}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-3 rounded-md shadow-md font-medium"
          >
            {isGenerating ? "Generating..." : "Generate Bill"}
          </button>
        )}
        {isGenerated && (
          <button
            onClick={downloadBillAsPDF}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md shadow-md font-medium"
          >
            Download PDF
          </button>
        )}
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
