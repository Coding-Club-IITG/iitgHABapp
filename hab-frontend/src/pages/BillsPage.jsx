import React, { useState, useEffect } from "react";
import { getAllBillsByMonth } from "../apis/mess";

const BillsPage = () => {
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

  const selectedMonthData = selectedMonthIndex !== null ? availableMonths[selectedMonthIndex] : null;
  const selectedMonth = selectedMonthData?.month ?? new Date().getMonth();
  const selectedYear = selectedMonthData?.year ?? new Date().getFullYear();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);

  const fetchBills = async () => {
    if (selectedMonthIndex === null) return;
    try {
      setLoading(true);
      setError("");
      const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString("default", { month: "long" });
      const data = await getAllBillsByMonth(monthName, selectedYear);
      setBills(data);
    } catch (err) {
      setError(err.message || "Failed to fetch bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [selectedMonthIndex]);

  // Separate hostels by generation status
  const generatedBills = bills.filter(b => b.isGenerated);
  const notGeneratedBills = bills.filter(b => !b.isGenerated);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Mess Bills</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {/* Month Selection */}
      <div className="mb-8 flex items-center gap-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
        <label className="text-sm font-medium text-gray-700">Select Month:</label>
        <select
          value={selectedMonthIndex ?? ""}
          onChange={(e) => setSelectedMonthIndex(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white min-w-[200px]"
        >
          <option value="">-- Select Month --</option>
          {availableMonths.map((item, idx) => {
            const monthName = new Date(item.year, item.month, 1).toLocaleString("default", { month: "long" });
            return (
              <option key={idx} value={idx}>
                {monthName} {item.year}
              </option>
            );
          })}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading bills...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Generated Bills */}
          <div className="border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="bg-green-50 border-b px-5 py-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-green-800">Generated Bills</h3>
                <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {generatedBills.length} Hostels
                </span>
              </div>
              <p className="text-xs text-green-700 mt-1 italic">
                * Click on any entry to view detailed calculations
              </p>
            </div>
            <div className="p-0 overflow-y-auto max-h-[600px]">
              {generatedBills.length === 0 ? (
                <div className="p-6 text-center text-gray-500 italic">No generated bills for this month.</div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 top-0 sticky">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hostel</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Claimed Amount</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Expenditure</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {generatedBills.map((bill) => (
                      <tr 
                        key={bill.hostelId} 
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedBill(bill)}
                      >
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{bill.hostel_name}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-right text-gray-700">{formatCurrency(bill.messBillClaimed)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatCurrency(bill.totalExpenditure)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Not Generated Bills */}
          <div className="border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="bg-amber-50 border-b px-5 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-amber-800">Pending Generation</h3>
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {notGeneratedBills.length} Hostels
              </span>
            </div>
            <div className="p-0 overflow-y-auto max-h-[600px]">
              {notGeneratedBills.length === 0 ? (
                <div className="p-6 text-center text-gray-500 italic">All bills have been generated!</div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {notGeneratedBills.map((bill) => (
                    <li key={bill.hostelId} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <span className="text-sm font-medium text-gray-900">{bill.hostel_name}</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Not Generated
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      )}

      {selectedBill && (
        <BillDetailsModal bill={selectedBill} onClose={() => setSelectedBill(null)} />
      )}
    </div>
  );
};

const BillDetailsModal = ({ bill, onClose }) => {
  if (!bill || !bill.billDetails) return null;
  const data = bill.billDetails;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const N = (Number(data.totalSubscribers) || 0) + (Number(data.totalSubscribersOffset) || 0);
  const R = (Number(data.rebateDays) || 0) + (Number(data.rebateDaysOffset) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <h3 className="text-xl font-bold text-gray-800">
            Mess Bill Details - {bill.hostel_name} ({data.month} {data.year})
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 focus:outline-none">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Formula</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3">Hostel Mess Account Number (Canara Bank)</td>
                  <td className="px-4 py-3 text-gray-500"></td>
                  <td className="px-4 py-3 font-medium">{data.accountNumber || "N/A"}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3">No of mess operating Days</td>
                  <td className="px-4 py-3 text-gray-500 italic">D</td>
                  <td className="px-4 py-3 font-medium">{data.operatingDays}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Mess Shutdown Date</td>
                  <td className="px-4 py-3 text-gray-500"></td>
                  <td className="px-4 py-3 font-medium">{data.shutdownDate}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3">Total No of mess subscribers</td>
                  <td className="px-4 py-3 text-gray-500 italic">N</td>
                  <td className="px-4 py-3 font-medium">{N}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">No of Mess Days (Actual days)</td>
                  <td className="px-4 py-3 text-gray-500 italic">M = N × D</td>
                  <td className="px-4 py-3 font-medium">{data.messDays}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3">Total Rebate Days</td>
                  <td className="px-4 py-3 text-gray-500 italic">R</td>
                  <td className="px-4 py-3 font-medium">{R}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Total no of consuming Days</td>
                  <td className="px-4 py-3 text-gray-500 italic">T1 = M - R</td>
                  <td className="px-4 py-3 font-medium">{data.consumingDays}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3">Food Cost</td>
                  <td className="px-4 py-3 text-gray-500 italic">F = T1 × 119</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(data.foodCost)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Total Wage</td>
                  <td className="px-4 py-3 text-gray-500 italic">W</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(data.totalWage)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3">Mess Bill (Claimed by caterer)</td>
                  <td className="px-4 py-3 text-gray-500 italic">B = 1.05 × (F + W)</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(data.messBillClaimed)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Mess Bill (Basic)</td>
                  <td className="px-4 py-3 text-gray-500 italic">F + W</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(data.messBill)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3">GST Amount, 5%</td>
                  <td className="px-4 py-3 text-gray-500 italic">GST = 5% × (F + W)</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(data.gstAmount)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">TDS Amount</td>
                  <td className="px-4 py-3 text-gray-500 italic">T2 = 0.02 × (F + W)</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(data.tdsAmount)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3">First Installment of Payment (to caterer)</td>
                  <td className="px-4 py-3 text-gray-500 italic">P1 = B - (T2 + (0.2×F)) - Misc</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(data.firstInstallment)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Second Installment of Payment (to caterer)</td>
                  <td className="px-4 py-3 text-gray-500 italic">P2 = 0.2 × F</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(data.secondInstallment)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3">Rebate Reimbursement (to student)</td>
                  <td className="px-4 py-3 text-gray-500 italic">RR = R × 119</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(data.rebateReimbursement)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Misc deduction</td>
                  <td className="px-4 py-3 text-gray-500 italic">Misc</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(data.miscDeduction)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3">HAB Transfer to hostel offices</td>
                  <td className="px-4 py-3 text-gray-500 italic">T3 = P1 + P2 + RR</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(data.habTransfer)}</td>
                </tr>
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td className="px-4 py-3 font-bold text-gray-800">Total Mess bill Expenditure (For HAB)</td>
                  <td className="px-4 py-3 text-blue-600 font-bold italic">T2 + T3</td>
                  <td className="px-4 py-3 font-bold text-blue-700 text-base">{formatCurrency(data.totalExpenditure)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillsPage;
