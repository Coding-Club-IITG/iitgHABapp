import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "../apis";
import Card from "./ui/Card";

// ── Toast ──────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors =
    type === "error"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-green-50 border-green-200 text-green-700";

  return (
    <div
      className={`fixed top-6 right-6 z-50 flex items-start gap-3 px-4 py-3 rounded-lg border shadow-md max-w-sm ${colors}`}
    >
      <span className="flex-1 text-sm">{message}</span>
      <button onClick={onClose} className="text-lg leading-none opacity-60 hover:opacity-100">
        ×
      </button>
    </div>
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ── Component ──────────────────────────────────────────────────────────────────
const MessClosureView = () => {
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Filter state
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterUpcoming, setFilterUpcoming] = useState(false);

  const showToast = (message, type = "error") => setToast({ message, type });

  const fetchClosures = useCallback(async () => {
   
setLoading(false);
return; // add this so the real API call is skipped
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries({
            month: filterMonth,
            year: filterYear,
            upcoming: filterUpcoming || undefined,
          }).filter(([, v]) => v !== "" && v !== undefined && v !== false)
        )
      ).toString();

    const url = `${API_BASE_URL}/hostel/closure/myHostel${params ? `?${params}` : ""}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClosures(response.data.closures || response.data || []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load mess closures.");
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterUpcoming]);

  useEffect(() => {
    fetchClosures();
  }, [fetchClosures]);

  // Find the next upcoming closure (for the highlight banner)
  const nextClosure = closures
    .filter((c) => new Date(c.closureDate) >= new Date())
    .sort((a, b) => new Date(a.closureDate) - new Date(b.closureDate))[0];

  return (
    <Card>
      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800">Mess Closures</h2>
        <p className="text-sm text-gray-500 mt-1">
          Scheduled mess closure days for your hostel. Contact HAB admin to make changes.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Next upcoming closure banner */}
        {nextClosure && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-amber-500 text-xl">📅</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Next Scheduled Closure</p>
              <p className="text-sm text-amber-700 mt-0.5">
                <span className="font-medium">{formatDate(nextClosure.closureDate)}</span>
                {nextClosure.reason && ` — ${nextClosure.reason}`}
              </p>
              {!nextClosure.isNotificationSent && (
                <p className="text-xs text-amber-600 mt-1">
                  Student notifications have not been sent yet.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Months</option>
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Year (e.g. 2025)"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterUpcoming}
                onChange={(e) => setFilterUpcoming(e.target.checked)}
                className="accent-blue-600"
              />
              Upcoming only
            </label>
            <button
              onClick={() => {
                setFilterMonth("");
                setFilterYear("");
                setFilterUpcoming(false);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : closures.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No mess closures found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Closure Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Month</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Scheduled By</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Notified</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {closures.map((c) => {
                  const closureDate = new Date(c.closureDate);
                  const isPast = closureDate < new Date();
                  return (
                    <tr
                      key={c._id}
                      className={isPast ? "bg-gray-50 text-gray-400" : ""}
                    >
                      <td className="px-4 py-3 font-medium">
                        {formatDate(c.closureDate)}
                      </td>
                      <td className="px-4 py-3">
                        {MONTHS[closureDate.getMonth()]} {closureDate.getFullYear()}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={c.reason}>
                        {c.reason || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {c.scheduledBy?.name || c.scheduledBy?.email || "HAB Admin"}
                      </td>
                      <td className="px-4 py-3">
                        {c.isNotificationSent ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                            Sent
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isPast ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                            Past
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                            Upcoming
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Info note */}
        <p className="text-xs text-gray-400">
          * Closures are managed by the HAB Admin. Please contact HAB if you notice any discrepancy.
        </p>
      </div>
    </Card>
  );
};

export default MessClosureView;
