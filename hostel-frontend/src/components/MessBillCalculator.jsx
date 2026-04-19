import React, { useState, useEffect, useMemo } from "react";
import { message } from "antd";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { getMessSubscribersCountByMonth, getCatererInfo } from "../apis/hostelApi";
import {
  getMessWorkers,
  generateMessBill,
  fetchMessBill,
  getRebateSummary,
  getSemesterRebateApplications,
  getMyMessShutdowns,
  openHostelRebateDocumentInNewTab,
  downloadMessBillExcel,
} from "../apis/messApi";

const MySwal = withReactContent(Swal);

/** Step 3 field label */
function FieldLabel({ children }) {
  return <div className="mb-1.5 text-sm font-medium text-gray-800">{children}</div>;
}

function BillSummaryTable({ billData, formatCurrency, formatINR0 }) {
  const c = "border border-gray-200 px-3 py-2 align-top";
  const f = `${c} text-center text-gray-600`;
  const v = `${c} bg-gray-50 text-center font-medium tabular-nums`;
  const vw = `${c} bg-amber-50/80 text-center font-semibold tabular-nums`;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-200 text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className={`${c} text-center font-semibold text-base`} colSpan={3}>
              Mess Bill Calculation Sheet
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={c}>Month and Year</td>
            <td className={f}></td>
            <td className={v}>
              {billData.month}, {billData.year}
            </td>
          </tr>
          <tr>
            <td className={c}>Hostel Name</td>
            <td className={f}></td>
            <td className={v}>{billData.hostelName}</td>
          </tr>
          <tr>
            <td className={c}>Caterer Name</td>
            <td className={f}></td>
            <td className={v}>{billData.catererName}</td>
          </tr>
          <tr>
            <td className={c}>Caterer account number (Canara Bank)</td>
            <td className={f}></td>
            <td className={v}>{billData.accountNumber}</td>
          </tr>
          <tr>
            <td className={c}>No of mess operating Days</td>
            <td className={f}>D</td>
            <td className={v}>{formatINR0(billData.operatingDays)}</td>
          </tr>
          <tr>
            <td className={c}>Mess Shutdown Days</td>
            <td className={f}></td>
            <td className={v}>{formatINR0(billData.shutdownDays || 0)}</td>
          </tr>
          <tr>
            <td className={c}>Total No of mess subscribers</td>
            <td className={f}>N</td>
            <td className={v}>
              {formatINR0(
                (Number(billData.totalSubscribers) || 0) + (Number(billData.totalSubscribersOffset) || 0),
              )}
            </td>
          </tr>
          <tr>
            <td className={c}>No of Mess Days (Actual days)</td>
            <td className={f}>M = N × D</td>
            <td className={v}>{formatINR0(billData.messDays)}</td>
          </tr>
          <tr>
            <td className={c}>Total Rebate Days</td>
            <td className={f}>R</td>
            <td className={v}>
              {formatINR0(
                (Number(billData.rebateDays) || 0) + (Number(billData.rebateDaysOffset) || 0),
              )}
            </td>
          </tr>
          <tr>
            <td className={c}>Total no of consuming Days</td>
            <td className={f}>T1= M-R</td>
            <td className={v}>{formatINR0(billData.consumingDays)}</td>
          </tr>
          <tr>
            <td className={c}>Food Cost</td>
            <td className={f}>F= T1 X 119</td>
            <td className={v}>{formatINR0(billData.foodCost)}</td>
          </tr>
          <tr>
            <td className={c}>Total Wage</td>
            <td className={f}>W</td>
            <td className={vw}>{formatINR0(billData.totalWage)}</td>
          </tr>
          <tr>
            <td className={c}>Mess Bill (Claimed by caterer)</td>
            <td className={f}>B= 1.05 X (F+W)</td>
            <td className={v}>{formatCurrency(billData.messBillClaimed)}</td>
          </tr>
          <tr>
            <td className={c}>Mess Bill</td>
            <td className={f}>F+W</td>
            <td className={v}>{formatCurrency(billData.messBill)}</td>
          </tr>
          <tr>
            <td className={c}>GST Amount, 5%</td>
            <td className={f}>GST=5%*(F+W)</td>
            <td className={v}>{formatCurrency(billData.gstAmount)}</td>
          </tr>
          <tr>
            <td className={c}>TDS Amount</td>
            <td className={f}>T2= 0.02 X (F+W)</td>
            <td className={v}>{formatCurrency(billData.tdsAmount)}</td>
          </tr>
          <tr>
            <td className={`${c} font-semibold`}>
              First Installment of Payment
              <br />
              from hostel office to the caterer
            </td>
            <td className={`${f} font-semibold`}>P1= B-(T2+(0.2*F))-Misc</td>
            <td className={`${v} font-semibold`}>{formatCurrency(billData.firstInstallment)}</td>
          </tr>
          <tr>
            <td className={`${c} font-semibold`}>
              Second Installment of Payment from
              <br />
              hostel office to the caterer
            </td>
            <td className={`${f} font-semibold`}>P2= 0.2 X F</td>
            <td className={`${v} font-semibold`}>{formatCurrency(billData.secondInstallment)}</td>
          </tr>
          <tr>
            <td className={c}>
              Rebate Reimbursement
              <br />
              (hostel office should release to the student)
            </td>
            <td className={f}>RR= R X 119</td>
            <td className={v}>{formatCurrency(billData.rebateReimbursement)}</td>
          </tr>
          <tr>
            <td className={c}>Misc deduction</td>
            <td className={f}>Misc</td>
            <td className={v}>{formatINR0(billData.miscDeduction)}</td>
          </tr>
          <tr>
            <td className={`${c} font-semibold`}>HAB Transfer to hostel offices</td>
            <td className={`${f} font-semibold`}>T3=P1+P2+RR</td>
            <td className={`${v} font-semibold`}>{formatCurrency(billData.habTransfer)}</td>
          </tr>
          <tr>
            <td className={`${c} font-semibold`}>
              Total Mess bill Expenditure
              <br />
              (For HAB Office Use Only)
            </td>
            <td className={`${f} font-semibold`}>T2+T3</td>
            <td className={`${v} font-semibold`}>{formatCurrency(billData.totalExpenditure)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const MessBillCalculator = ({ hostelId, hostelName }) => {
  // Generate available months (semester months only: exclude June, July, December)
  const getAvailableMonths = () => {
    const months = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Get past 12 months (including current month)
    for (let i = 11; i >= 0; i--) {
      let month = currentMonth - i;
      let year = currentYear;

      if (month < 0) {
        month += 12;
        year -= 1;
      }

      // Exclude: June (5), December (11). Keep July.
      if (![5, 11].includes(month)) {
        months.push({ year, month });
      }
    }

    return months.reverse();
  };

  const availableMonths = getAvailableMonths();
  const defaultMonthIndex = (() => {
    if (!availableMonths.length) return null;
    const now = new Date();
    const idx = availableMonths.findIndex(
      (m) => m.year === now.getFullYear() && m.month === now.getMonth(),
    );
    return idx >= 0 ? idx : availableMonths.length - 1;
  })();

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(defaultMonthIndex);

  const selectedMonthData =
    selectedMonthIndex !== null ? availableMonths[selectedMonthIndex] : null;
  const selectedMonth = selectedMonthData?.month ?? new Date().getMonth();
  const selectedYear = selectedMonthData?.year ?? new Date().getFullYear();

  const [billData, setBillData] = useState({
    month: new Date().toLocaleString("default", { month: "long" }),
    year: new Date().getFullYear(),
    hostelName: hostelName || "",
    catererName: "",
    accountNumber: "",
    operatingDays: 30,
    shutdownDate: "NA",
    shutdownDays: 0,
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
  const [step, setStep] = useState(1);

  // Step 1: acknowledged (not processed) rebate applications for selected month/year
  const [rebateApplications, setRebateApplications] = useState([]);
  const [selectedRebateApplications, setSelectedRebateApplications] = useState([]);
  /** Saved MessBill from API when a bill exists for the selected month (includes billLink). */
  const [savedBill, setSavedBill] = useState(null);

  // Consistent disabled style for fields locked after bill generation
  const lockedClass = isGenerated
    ? "bg-gray-200 text-gray-500 cursor-not-allowed opacity-70 border-gray-300"
    : "";

  const roField =
    "w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50 text-gray-900 text-[15px] tabular-nums cursor-default";
  const edField = (extra = "") =>
    `w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-[15px] tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-gray-400 ${extra}`;

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

  const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const countShutdownDaysInMonth = (shutdowns, year, monthIdx) => {
    const monthStart = new Date(year, monthIdx, 1);
    const monthEnd = new Date(year, monthIdx + 1, 0);
    const start = dateOnly(monthStart);
    const end = dateOnly(monthEnd);

    let days = 0;
    for (const s of shutdowns || []) {
      const sStart = dateOnly(new Date(s.startDate));
      const sEnd = dateOnly(new Date(s.endDate));
      if (Number.isNaN(sStart.getTime()) || Number.isNaN(sEnd.getTime())) continue;
      if (sEnd < start || sStart > end) continue;

      const overlapStart = sStart > start ? sStart : start;
      const overlapEnd = sEnd < end ? sEnd : end;
      const diffDays = Math.floor((overlapEnd - overlapStart) / (24 * 60 * 60 * 1000)) + 1;
      days += Math.max(0, diffDays);
    }
    return days;
  };

  const formatShutdownDatesForMonth = (shutdowns, year, monthIdx) => {
    const monthStart = new Date(year, monthIdx, 1);
    const monthEnd = new Date(year, monthIdx + 1, 0);
    const start = dateOnly(monthStart);
    const end = dateOnly(monthEnd);

    const parts = [];
    for (const s of shutdowns || []) {
      const sStart = dateOnly(new Date(s.startDate));
      const sEnd = dateOnly(new Date(s.endDate));
      if (Number.isNaN(sStart.getTime()) || Number.isNaN(sEnd.getTime())) continue;
      if (sEnd < start || sStart > end) continue;

      const overlapStart = sStart > start ? sStart : start;
      const overlapEnd = sEnd < end ? sEnd : end;

      const a = overlapStart.toLocaleDateString();
      const b = overlapEnd.toLocaleDateString();
      parts.push(a === b ? a : `${a} - ${b}`);
    }

    return parts.length ? parts.join(", ") : "NA";
  };

  // Fetch mess shutdowns (from DB) and auto-calc operating days
  useEffect(() => {
    const run = async () => {
      try {
        if (!hostelId) return;
        const shutdowns = await getMyMessShutdowns();
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const shutdownDays = countShutdownDaysInMonth(shutdowns, selectedYear, selectedMonth);
        const operatingDays = Math.max(0, daysInMonth - shutdownDays);
        const shutdownDate = formatShutdownDatesForMonth(shutdowns, selectedYear, selectedMonth);

        setBillData((prev) => ({
          ...prev,
          operatingDays,
          shutdownDate,
          shutdownDays,
        }));
      } catch (e) {
        // Non-blocking: keep existing values if shutdown fetch fails
        console.error("Failed to fetch shutdowns:", e);
      }
    };

    run();
  }, [hostelId, selectedMonthIndex]);

  const checkBillStatus = async () => {
    try {
      if (!hostelId) return;
      const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString("default", { month: "long" });
      const existingBill = await fetchMessBill(hostelId, monthName, selectedYear);
      if (existingBill && existingBill.billLink) {
        setSavedBill(existingBill);
        setIsGenerated(true);
        setBillData((prev) => ({
          ...prev,
          month: existingBill.month ?? monthName,
          year: existingBill.year ?? selectedYear,
          hostelName: existingBill.hostelName ?? prev.hostelName,
          catererName: existingBill.catererName || prev.catererName,
          accountNumber: existingBill.accountNumber ?? prev.accountNumber,
          operatingDays: existingBill.operatingDays ?? prev.operatingDays,
          shutdownDate: existingBill.shutdownDate ?? prev.shutdownDate,
          totalSubscribers: existingBill.totalSubscribers ?? prev.totalSubscribers,
          totalSubscribersOffset: existingBill.totalSubscribersOffset ?? 0,
          messDays: existingBill.messDays ?? 0,
          rebateDays: existingBill.rebateDays ?? 0,
          rebateDaysOffset: existingBill.rebateDaysOffset ?? 0,
          consumingDays: existingBill.consumingDays ?? 0,
          foodCost: existingBill.foodCost ?? 0,
          totalWage: existingBill.totalWage ?? 0,
          messBillClaimed: existingBill.messBillClaimed ?? 0,
          messBill: existingBill.messBill ?? 0,
          gstAmount: existingBill.gstAmount ?? 0,
          tdsAmount: existingBill.tdsAmount ?? 0,
          firstInstallment: existingBill.firstInstallment ?? 0,
          secondInstallment: existingBill.secondInstallment ?? 0,
          rebateReimbursement: existingBill.rebateReimbursement ?? 0,
          miscDeduction: existingBill.miscDeduction ?? 0,
          habTransfer: existingBill.habTransfer ?? 0,
          totalExpenditure: existingBill.totalExpenditure ?? 0,
        }));
        if (existingBill.workerAttendances) {
          const wa = existingBill.workerAttendances;
          const obj =
            typeof wa === "object" && wa !== null && !Array.isArray(wa)
              ? { ...wa }
              : {};
          setWorkerAttendances(obj);
        }
      } else {
        setSavedBill(null);
        setIsGenerated(false);
        setBillData((prev) => ({
          ...prev,
          totalSubscribersOffset: 0,
          rebateDaysOffset: 0,
          miscDeduction: 0,
        }));
        setWorkerAttendances((prev) => {
          const reset = {};
          Object.keys(prev).forEach((id) => {
            reset[id] = 26;
          });
          return reset;
        });
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setSavedBill(null);
        setIsGenerated(false);
        setBillData((prev) => ({
          ...prev,
          totalSubscribersOffset: 0,
          rebateDaysOffset: 0,
          miscDeduction: 0,
        }));
        setWorkerAttendances((prev) => {
          const reset = {};
          Object.keys(prev).forEach((id) => {
            reset[id] = 26;
          });
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

      const [subscribersCountRes, workersData, semesterRebates, catererPayload] =
        await Promise.all([
          getMessSubscribersCountByMonth(fetchMonth, fetchYear),
          getMessWorkers(),
          getSemesterRebateApplications(fetchMonth, fetchYear).catch((err) => {
            console.error("Failed to fetch semester rebate applications:", err);
            return { applications: [] };
          }),
          getCatererInfo().catch((err) => {
            if (err?.response?.status !== 404) {
              console.error("Failed to fetch caterer info:", err);
            }
            return null;
          }),
        ]);

      const initialAttendances = {};
      workersData.forEach(w => {
        initialAttendances[w._id] = 26;
      });
      setWorkerAttendances(initialAttendances);
      setWorkers(workersData);

      setBillData((prev) => ({
        ...prev,
        totalSubscribers: Number(subscribersCountRes?.count) || 0,
        catererName: catererPayload?.catererName?.trim() || "—",
        // Step 1 controls rebateDays via selected applications
        rebateDays: 0,
      }));

      setRebateApplications(Array.isArray(semesterRebates?.applications) ? semesterRebates.applications : []);
      setSelectedRebateApplications([]);
      setStep(1);

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
      // W should match payroll.xlsx "Total Gross" sum (not just basic rate*attendance).
      const attendance =
        workerAttendances[worker._id] !== undefined
          ? workerAttendances[worker._id]
          : 26;
      const days = Number(attendance) || 0;
      const rate = Number(worker.rate) || 0;

      // Payroll.xlsx formulas:
      // Basic = Rate * Attendance
      // Service charge = ROUND(Basic*0.03,0)
      // EPF employer = ROUND(MIN(Basic,15000)*0.13,0)
      // ESI employer = IF(Basic<=21000,ROUND(Basic*0.0325,0),0)
      // Bonus = IF(Basic>21000,0,ROUND(7000*0.0833,0))
      const basic = Math.round(rate * days);
      const serviceCharge = Math.round(basic * 0.03);
      const pfEmployer = Math.round(Math.min(basic, 15000) * 0.13);
      const esiEmployer = basic <= 21000 ? Math.round(basic * 0.0325) : 0;
      const bonus = basic > 21000 ? 0 : Math.round(7000 * 0.0833);
      const totalGross = basic + serviceCharge + pfEmployer + esiEmployer + bonus;

      return sum + totalGross;
    }, 0);
    setBillData((prev) => ({
      ...prev,
      totalWage: totalWageCalc,
    }));
  }, [workers, workerAttendances]);

  // Step 1 -> Step 3: sum selected rebate days
  useEffect(() => {
    const totalSelectedDays = (selectedRebateApplications || []).reduce((sum, app) => {
      return sum + (Number(app?.numberOfDays) || 0);
    }, 0);
    setBillData((prev) => ({
      ...prev,
      rebateDays: totalSelectedDays,
    }));
  }, [selectedRebateApplications]);

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

  /** All Step 3 inputs must be present before Step 4 / generate (read-only fields + editable numeric/text). */
  const isStep3Complete = useMemo(() => {
    const trim = (s) => String(s ?? "").trim();
    if (!trim(billData.hostelName)) return false;
    const caterer = trim(billData.catererName);
    if (!caterer || caterer === "—") return false;
    if (!trim(billData.accountNumber)) return false;

    const numFilled = (v) => {
      if (v === "" || v === null || v === undefined) return false;
      return !Number.isNaN(Number(v));
    };
    if (!numFilled(billData.totalSubscribersOffset)) return false;
    if (!numFilled(billData.rebateDaysOffset)) return false;
    if (!numFilled(billData.miscDeduction)) return false;

    return true;
  }, [billData]);

  const handleGenerateBill = async () => {
    if (!hostelId) {
      setError("Hostel ID is missing");
      return;
    }
    if (!isStep3Complete) {
      message.warning("Please complete all fields in Step 3 before generating the bill.");
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
        workerAttendances,
        rebateApplicationIds: selectedRebateApplications
          .map((a) => a?._id)
          .filter(Boolean),
      };

      console.log("Sending generate mess bill request...", payloadBillData);
      await generateMessBill(payloadBillData, hostelId);
      await checkBillStatus();
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

  const formatINR0 = (amount) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
      Number(amount) || 0,
    );

  // Step 2 payroll sheet formulas (from payroll.xlsx)
  const SHEET = {
    // Column definitions (as in sheet):
    // 1: Rate
    // 2: Atten
    // 3: Basic + VDA = Rate * Atten
    // 4: Service charge = 3% of Column 3
    // 5: EPF employer contribution = 13% of Column 3, ceiling wage 15000 (=> max 1950)
    // 6: ESI employer contribution = 3.25% of Column 3, ceiling wage 21000
    // 7: Bonus = 8.33% of 7000, only when Column 3 <= 21000
    // 8: Total Gross = Column 3 + 4 + 5 + 6 + 7
    // 9: EPF total (employer+employee) = 25% of min(Column 3, 15000) (=> max 3750)
    // 10: ESI total (employer+employee) = 4% of Column 3 when Column 3 <= 21000 else 0
    // 11: Service charge (repeat)
    // 12: Net payment = 8 - 9 - 10 - 11
    serviceChargePct: 0.03,
    pfWageCap: 15000,
    pfEmployerPct: 0.13,
    epfTotalPct: 0.25,
    esiWageCap: 21000,
    esiEmployerPct: 0.0325,
    esiTotalPct: 0.04,
    bonusBase: 7000,
    bonusPct: 0.0833,
  };

  const computeWorkerSheetRow = (worker) => {
    const attendance = Number(workerAttendances[worker._id] ?? 26) || 0;
    const rate = Number(worker.rate) || 0;
    // Excel:
    // F = D*E
    // G = ROUND(F*0.03,0)
    // H = ROUND(MIN(F,15000)*0.13,0)
    // I = IF(F<=21000,ROUND(F*0.0325,0),0)
    // J = IF(F>21000,0,ROUND(7000*0.0833,0))
    // K = F+G+H+I+J
    // L = ROUND(MIN(F,15000)*0.25,0)
    // M = IF(F<=21000,ROUND(F*0.04,0),0)
    // N = G
    // O = K-L-M-N

    const basic = Math.round(rate * attendance); // Col 3
    const serviceCharge = Math.round(basic * SHEET.serviceChargePct); // Col 4 (G)

    const pfWage = Math.min(basic, SHEET.pfWageCap);
    const pfEmployer = Math.round(pfWage * SHEET.pfEmployerPct); // Col 5 (H)

    const esiEmployer =
      basic <= SHEET.esiWageCap
        ? Math.round(basic * SHEET.esiEmployerPct) // Col 6 (I)
        : 0;

    const bonus =
      basic > SHEET.esiWageCap
        ? 0
        : Math.round(SHEET.bonusBase * SHEET.bonusPct); // Col 7 (J)

    const totalGross = basic + serviceCharge + pfEmployer + esiEmployer + bonus; // Col 8 (K)

    const epfTotal = Math.round(pfWage * SHEET.epfTotalPct); // Col 9 (L)
    const esiTotal =
      basic <= SHEET.esiWageCap ? Math.round(basic * SHEET.esiTotalPct) : 0; // Col 10 (M)
    const netPay = totalGross - epfTotal - esiTotal - serviceCharge; // Col 12 (O)

    return {
      attendance,
      rate,
      basic,
      serviceCharge,
      pfEmployer,
      esiEmployer,
      bonus,
      totalGross,
      epfTotal,
      esiTotal,
      netPay,
    };
  };

  const openRebateDetails = (app) => {
    if (!app) return;

    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const escAttr = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;");
    const fmtDt = (d) => {
      if (!d) return "N/A";
      try {
        return new Date(d).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
      } catch {
        return "N/A";
      }
    };
    const fmtDate = (d) => {
      if (!d) return "N/A";
      try {
        return new Date(d).toLocaleDateString();
      } catch {
        return "N/A";
      }
    };
    const docLink = (label, url, docType) => {
      const u = url && String(url).trim();
      if (!u) {
        return `<div style="margin-bottom:6px"><b>${esc(label)}:</b> <span style="color:#6b7280">—</span></div>`;
      }
      return `<div style="margin-bottom:6px"><b>${esc(label)}:</b> <a href="#" class="rebate-doc-link" data-doc-type="${escAttr(docType)}" style="color:#2563eb;text-decoration:underline;cursor:pointer">Open PDF</a></div>`;
    };

    const userName = app.user?.name ?? "N/A";
    const roll = app.user?.rollNumber ?? "N/A";
    const email = app.user?.email ?? "N/A";

    MySwal.fire({
      title: "Rebate application",
      width: 560,
      didOpen: (popup) => {
        popup.querySelectorAll("a.rebate-doc-link").forEach((el) => {
          el.addEventListener("click", async (e) => {
            e.preventDefault();
            const t = el.getAttribute("data-doc-type");
            if (!t || !app._id) return;
            try {
              await openHostelRebateDocumentInNewTab(app._id, t);
            } catch (err) {
              console.error(err);
              message.error(err?.message || "Could not open document");
            }
          });
        });
      },
      html: `
        <div style="text-align:left;font-size:13px;line-height:1.65;max-height:70vh;overflow-y:auto;padding-right:4px">
          <div style="margin-bottom:6px"><b>Application ID:</b> ${esc(String(app._id ?? ""))}</div>
          <div style="margin-bottom:6px"><b>Name:</b> ${esc(userName)}</div>
          <div style="margin-bottom:6px"><b>Roll:</b> ${esc(roll)}</div>
          <div style="margin-bottom:6px"><b>Email:</b> ${esc(email)}</div>
          <hr style="margin:10px 0;border:none;border-top:1px solid #e5e7eb" />
          <div style="margin-bottom:6px"><b>Leave type:</b> ${esc(app.leaveType)}</div>
          <div style="margin-bottom:6px"><b>Leave period:</b> ${esc(fmtDate(app.startDate))} → ${esc(fmtDate(app.endDate))}</div>
          <div style="margin-bottom:6px"><b>Days:</b> ${esc(app.numberOfDays)}</div>
          <div style="margin-bottom:6px"><b>Status:</b> ${esc(app.status)}</div>
          <hr style="margin:10px 0;border:none;border-top:1px solid #e5e7eb" />
          <div style="margin-bottom:6px"><b>Applied at:</b> ${esc(fmtDt(app.appliedAt))}</div>
          <div style="margin-bottom:6px"><b>Acknowledged at:</b> ${esc(fmtDt(app.acknowledgedAt))}</div>
          <div style="margin-bottom:6px"><b>Processed at:</b> ${esc(fmtDt(app.processedAt))}</div>
          <hr style="margin:10px 0;border:none;border-top:1px solid #e5e7eb" />
          ${docLink("Leave document", app.leaveDocumentUrl, "leave")}
          ${docLink("Proof document", app.proofDocumentUrl, "proof")}
          <hr style="margin:10px 0;border:none;border-top:1px solid #e5e7eb" />
          <div style="font-size:12px;color:#374151;margin-bottom:4px"><b>Bank details (rebate)</b></div>
          <div class="rebate-detail-row"><b>Account holder:</b> ${esc(app.bankAccountHoldersName)}</div>
          <div class="rebate-detail-row"><b>Account number:</b> ${esc(app.bankAccountNumber)}</div>
          <div class="rebate-detail-row"><b>IFSC:</b> ${esc(app.bankIFSCCode)}</div>
          <div class="rebate-detail-row"><b>Bank name:</b> ${esc(app.bankName)}</div>
        </div>
      `,
      confirmButtonText: "Close",
      customClass: { popup: "rounded-2xl text-left" },
    });
  };

  const isRebateSelected = (id) =>
    selectedRebateApplications.some((a) => String(a?._id) === String(id));

  const addRebateToBill = (app) => {
    if (!app?._id) return;
    if (isRebateSelected(app._id)) return;
    setSelectedRebateApplications((prev) => [...prev, app]);
  };

  const removeRebateFromBill = (id) => {
    setSelectedRebateApplications((prev) =>
      prev.filter((a) => String(a?._id) !== String(id)),
    );
  };

  if (loading) {
    return <div className="p-4 text-center">Loading mess subscribers...</div>;
  }

  const showGeneratedOnly = Boolean(savedBill?.billLink);

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-6">
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

      {showGeneratedOnly ? (
        <div className="space-y-6">
          <p className="text-sm text-gray-600">
            Bill generated for this month. Download the Excel file from OneDrive.
          </p>
          <BillSummaryTable
            billData={billData}
            formatCurrency={formatCurrency}
            formatINR0={formatINR0}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                if (!hostelId) return;
                try {
                  await downloadMessBillExcel(hostelId, billData.month, billData.year);
                } catch (e) {
                  message.error(e?.message || "Could not download Excel file.");
                }
              }}
              className="inline-flex items-center justify-center rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Download Excel
            </button>
          </div>
          <p className="text-sm italic text-gray-500">
            Above data has been verified and found to be true and correct.
          </p>
        </div>
      ) : (
      <>
      {/* Steps */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`px-3 py-1.5 rounded-md border text-sm font-medium ${
            step === 1
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Step 1: Rebate Calculation
        </button>
        <button
          type="button"
          onClick={() => setStep(2)}
          className={`px-3 py-1.5 rounded-md border text-sm font-medium ${
            step === 2
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Step 2: Mess Workers Salary
        </button>
        <button
          type="button"
          onClick={() => setStep(3)}
          className={`px-3 py-1.5 rounded-md border text-sm font-medium ${
            step === 3
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Step 3: Mess Information
        </button>
        <button
          type="button"
          onClick={() => {
            if (!isStep3Complete) {
              message.warning(
                "Please complete all fields in Step 3 (including caterer account number and numeric fields) before continuing.",
              );
              return;
            }
            setStep(4);
          }}
          disabled={step !== 4 && !isStep3Complete}
          title={
            step !== 4 && !isStep3Complete
              ? "Complete Step 3: hostel/caterer details, account number, and offsets/misc."
              : undefined
          }
          className={`px-3 py-1.5 rounded-md border text-sm font-medium ${
            step === 4
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white`}
        >
          Step 4: Bill Summary
        </button>
        {step === 1 && (
          <div className="ml-auto text-sm text-gray-600">
            Selected rebate days:{" "}
            <span className="font-semibold text-gray-900">
              {Number(billData.rebateDays) || 0}
            </span>
          </div>
        )}
      </div>

      {step === 1 && (
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Rebate Applications (Acknowledged, not processed)
              </h3>
              <p className="text-sm text-gray-500">
                Click an application to view details. Use “Add to Bill” to
                include its days in this bill.
              </p>
            </div>
            <div className="text-sm text-gray-700">
              Added:{" "}
              <span className="font-semibold">
                {selectedRebateApplications.length}
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border border-gray-300 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    Name
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    Roll
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    Start
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    End
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    Days
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {rebateApplications.length === 0 ? (
                  <tr>
                    <td
                      className="border border-gray-300 px-3 py-3 text-center text-gray-500"
                      colSpan="6"
                    >
                      No acknowledged applications found for this month/year.
                    </td>
                  </tr>
                ) : (
                  rebateApplications.map((app) => {
                    const selected = isRebateSelected(app?._id);
                    return (
                      <tr
                        key={app._id}
                        className={`cursor-pointer hover:bg-gray-50 ${
                          selected ? "bg-blue-50" : ""
                        }`}
                        onClick={() => openRebateDetails(app)}
                      >
                        <td className="border border-gray-300 px-3 py-2">
                          {app.user?.name || "N/A"}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {app.user?.rollNumber || "N/A"}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {app.startDate
                            ? new Date(app.startDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {app.endDate
                            ? new Date(app.endDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {app.numberOfDays ?? "N/A"}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {selected ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRebateFromBill(app._id);
                              }}
                              className="px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 text-xs"
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addRebateToBill(app);
                              }}
                              className="px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs"
                            >
                              Add to Bill
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Mess Workers Salary Calculation
            </h3>
            <div className="text-sm text-gray-600">
              Total Mess Wage (W):{" "}
              <span className="font-semibold text-gray-900">
                {formatCurrency(billData.totalWage)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300 text-xs">
              <thead className="bg-gray-100">
                <tr className="bg-white">
                  <th className="border border-gray-300 px-2 py-1"></th>
                  <th className="border border-gray-300 px-2 py-1"></th>
                  <th className="border border-gray-300 px-2 py-1"></th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">1</th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">2</th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">3</th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">4</th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">5</th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">6</th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">7</th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">8</th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">9</th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">10</th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">11</th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold">12</th>
                </tr>
                <tr>
                  <th className="border border-gray-300 px-2 py-2 text-left">Sl. No</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">Name</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">Designation</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">Rate</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">Attendance</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">
                    Basic + VDA
                    <br />
                    (Column 1 * Column 2)
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-left">Service charge in the procurement of manpower outsourcing service (3% of Column 3)</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">
                    {"{ER (3.67%) +EPS (8.33%) +EDLI (.5%)+ ADM CHARGE (.5%)}"}
                    <br />
                    {"[Column 3 of 13%]"}
                    <br />
                    {"[Ceiling Amount=1500]"}
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-left">
                    ESI
                    <br />
                    {"[Column 3 of 3.25%]"}
                    <br />
                    {"[Ceiling Amount=21000]"}
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-left">
                    Bonus
                    <br />
                    (8.33% of 7000)
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-left bg-yellow-100">Total Gross</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">
                    EPF (Employer Contribution= Column 3 of 13%+ Employee Contribution=Column 3 of 12%)
                    <br />
                    [Total 25%]
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-left">
                    ESI
                    <br />
                    (EMPLOYER CONTRIBUTION: Column 3 of 3.25%+ Employee Contribution = Column 3 of .75%)
                    <br />
                    [Total 4%]
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-left">
                    Service charge in the procurement of manpower outsourcing service
                    <br />
                    (3% of Column 3)
                  </th>
                  <th className="border border-gray-300 px-2 py-2 text-left bg-yellow-100">Net payment to the employees</th>
                </tr>
              </thead>
              <tbody>
                {workers.length === 0 ? (
                  <tr>
                    <td
                      className="border border-gray-300 px-4 py-3 text-center text-gray-500"
                      colSpan="15"
                    >
                      No workers found.
                    </td>
                  </tr>
                ) : (
                  workers.map((worker, idx) => {
                    const r = computeWorkerSheetRow(worker);
                    return (
                      <tr key={worker._id}>
                        <td className="border border-gray-300 px-2 py-2">{idx + 1}</td>
                        <td className="border border-gray-300 px-2 py-2 text-gray-900">
                          {worker.name}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-gray-700">
                          {worker.designation}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-gray-900">
                          {formatINR0(r.rate)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            max="31"
                            disabled={isGenerated}
                            value={workerAttendances[worker._id] ?? 26}
                            onChange={(e) =>
                              handleAttendanceChange(worker._id, e.target.value)
                            }
                            className={`w-16 px-2 py-1 border rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium ${
                              isGenerated ? lockedClass : "border-gray-300"
                            }`}
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(r.basic)}</td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(r.serviceCharge)}</td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(r.pfEmployer)}</td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(r.esiEmployer)}</td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(r.bonus)}</td>
                        <td className="border border-gray-300 px-2 py-2 bg-yellow-50 font-semibold">
                          {formatINR0(r.totalGross)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          {formatINR0(r.epfTotal)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          {formatINR0(r.esiTotal)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          {formatINR0(r.serviceCharge)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 bg-yellow-100 font-semibold">
                          {formatINR0(r.netPay)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {workers.length > 0 && (
                <tfoot>
                  {(() => {
                    const totals = workers.reduce(
                      (acc, w) => {
                        const r = computeWorkerSheetRow(w);
                        acc.basic += r.basic;
                        acc.serviceCharge += r.serviceCharge;
                        acc.pfEmployer += r.pfEmployer;
                        acc.esiEmployer += r.esiEmployer;
                        acc.bonus += r.bonus;
                        acc.totalGross += r.totalGross;
                        acc.epfTotal += r.epfTotal;
                        acc.esiTotal += r.esiTotal;
                        acc.netPay += r.netPay;
                        return acc;
                      },
                      {
                        basic: 0,
                        serviceCharge: 0,
                        pfEmployer: 0,
                        esiEmployer: 0,
                        bonus: 0,
                        totalGross: 0,
                        epfTotal: 0,
                        esiTotal: 0,
                        netPay: 0,
                      },
                    );
                    return (
                      <tr className="bg-gray-50 font-semibold">
                        <td className="border border-gray-300 px-2 py-2" colSpan="5">
                          Total
                        </td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(totals.basic)}</td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(totals.serviceCharge)}</td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(totals.pfEmployer)}</td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(totals.esiEmployer)}</td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(totals.bonus)}</td>
                        <td className="border border-gray-300 px-2 py-2 bg-yellow-50">{formatINR0(totals.totalGross)}</td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(totals.epfTotal)}</td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(totals.esiTotal)}</td>
                        <td className="border border-gray-300 px-2 py-2">{formatINR0(totals.serviceCharge)}</td>
                        <td className="border border-gray-300 px-2 py-2 bg-yellow-100">{formatINR0(totals.netPay)}</td>
                      </tr>
                    );
                  })()}
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-3xl space-y-10">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">General information</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <FieldLabel>Month and Year</FieldLabel>
                <input
                  type="text"
                  value={`${billData.month}, ${billData.year}`}
                  className={roField}
                  readOnly
                  tabIndex={-1}
                />
                <p className="mt-1.5 text-xs text-gray-500">From the month selector above.</p>
              </div>
              <div>
                <FieldLabel>Hostel Name</FieldLabel>
                <input
                  type="text"
                  value={billData.hostelName}
                  className={roField}
                  readOnly
                  tabIndex={-1}
                />
                <p className="mt-1.5 text-xs text-gray-500">From your hostel account.</p>
              </div>
              <div>
                <FieldLabel>Caterer Name</FieldLabel>
                <input
                  type="text"
                  value={billData.catererName}
                  className={roField}
                  readOnly
                  tabIndex={-1}
                />
                <p className="mt-1.5 text-xs text-gray-500">From the caterer (mess) assigned to your hostel.</p>
              </div>
              <div>
                <FieldLabel>Caterer account number (Canara Bank)</FieldLabel>
                <input
                  type="text"
                  value={billData.accountNumber}
                  onChange={(e) => handleInputChange("accountNumber", e.target.value)}
                  disabled={isGenerated}
                  className={isGenerated ? `${roField} ${lockedClass}` : edField()}
                  placeholder="Enter account number"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Days, subscribers, and rebates</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <FieldLabel>No of mess operating Days (D)</FieldLabel>
                <input type="number" value={billData.operatingDays} className={roField} readOnly tabIndex={-1} />
                <p className="mt-1.5 text-xs text-gray-500">
                  Days in month − shutdown days ({billData.shutdownDays || 0}).
                </p>
              </div>
              <div>
                <FieldLabel>Mess shutdown days (this month)</FieldLabel>
                <input type="number" value={billData.shutdownDays || 0} className={roField} readOnly tabIndex={-1} />
                <p className="mt-1.5 text-xs text-gray-500">Shutdown dates: {billData.shutdownDate || "NA"}</p>
              </div>

              <div className="md:col-span-2">
                <p className="mb-3 text-xs font-medium text-gray-700">Subscribers (N)</p>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Total mess subscribers</FieldLabel>
                    <input
                      type="number"
                      value={billData.totalSubscribers}
                      className={roField}
                      readOnly
                      tabIndex={-1}
                    />
                    <p className="mt-1.5 text-xs text-gray-500">From subscriber count for this month.</p>
                  </div>
                  <div>
                    <FieldLabel>Manual offset (subscribers)</FieldLabel>
                    <input
                      type="number"
                      value={billData.totalSubscribersOffset}
                      onChange={(e) => handleInputChange("totalSubscribersOffset", e.target.value)}
                      disabled={isGenerated}
                      className={isGenerated ? `${roField} ${lockedClass}` : edField()}
                      placeholder="0"
                    />
                    <p className="mt-1.5 text-xs text-gray-500">Only if you must adjust N.</p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <p className="mb-3 text-xs font-medium text-gray-700">Rebate days (R)</p>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Total rebate days</FieldLabel>
                    <input type="number" value={billData.rebateDays} className={roField} readOnly tabIndex={-1} />
                    <p className="mt-1.5 text-xs text-gray-500">Sum from Step 1 selections.</p>
                  </div>
                  <div>
                    <FieldLabel>Manual offset (rebate days)</FieldLabel>
                    <input
                      type="number"
                      value={billData.rebateDaysOffset}
                      onChange={(e) => handleInputChange("rebateDaysOffset", e.target.value)}
                      disabled={isGenerated}
                      className={isGenerated ? `${roField} ${lockedClass}` : edField()}
                      placeholder="0"
                    />
                    <p className="mt-1.5 text-xs text-gray-500">Only if you must adjust R.</p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Misc deduction</FieldLabel>
                <input
                  type="number"
                  value={billData.miscDeduction}
                  disabled={isGenerated}
                  onChange={(e) => handleInputChange("miscDeduction", e.target.value)}
                  className={isGenerated ? `${roField} ${lockedClass}` : edField()}
                  placeholder="0"
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {step === 4 && (
      <>
      {/* Bill Summary (match sheet image) */}
      <div className="mt-8">
        <BillSummaryTable
          billData={billData}
          formatCurrency={formatCurrency}
          formatINR0={formatINR0}
        />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {!isGenerated && (
          <button
            onClick={handleGenerateBill}
            disabled={isGenerating || loading}
            className="rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Generate Bill"}
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-sm italic text-gray-500">
        Above data has been verified and found to be true and correct.
      </p>
      </>
      )}
      </>
      )}
    </div>
  );
};

export default MessBillCalculator;
