import React, { useEffect, useMemo, useState } from "react";
import { createMessShutdown, deleteMessShutdown, getMessShutdowns } from "../apis/mess";

function formatDate(d) {
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

export default function MessShutdowns({ hostelId }) {
  const [shutdowns, setShutdowns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [type, setType] = useState("SINGLE_DAY");
  const [date, setDate] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const canSubmit = useMemo(() => {
    if (!hostelId) return false;
    if (type === "SINGLE_DAY") return !!date;
    return !!fromDate && !!toDate;
  }, [hostelId, type, date, fromDate, toDate]);

  const fetchShutdowns = async () => {
    if (!hostelId) return;
    try {
      setLoading(true);
      setError("");
      const data = await getMessShutdowns(hostelId);
      setShutdowns(data);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to load shutdowns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShutdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostelId]);

  const handleCreate = async () => {
    try {
      setLoading(true);
      setError("");

      const payload =
        type === "SINGLE_DAY"
          ? { hostelId, type, date }
          : { hostelId, type, fromDate, toDate };

      await createMessShutdown(payload);
      setDate("");
      setFromDate("");
      setToDate("");
      await fetchShutdowns();
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to create shutdown",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Delete this mess shutdown?");
    if (!ok) return;
    try {
      setLoading(true);
      setError("");
      await deleteMessShutdown(id);
      await fetchShutdowns();
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to delete shutdown",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Create Mess Shutdown
            </div>
            <div className="text-xs text-gray-500">
              Single day or date range (per hostel)
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Type
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={loading}
            >
              <option value="SINGLE_DAY">Single day</option>
              <option value="RANGE">Range</option>
            </select>
          </div>

          {type === "SINGLE_DAY" ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Date
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={loading}
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  From
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  To
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div className="md:col-span-1">
            <button
              onClick={handleCreate}
              disabled={!canSubmit || loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Create"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-600">{error}</div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="text-sm font-semibold text-gray-900">
            Existing Shutdowns
          </div>
          <div className="text-xs text-gray-500">
            Newest first. Overlapping ranges are blocked.
          </div>
        </div>

        {loading && shutdowns.length === 0 ? (
          <div className="p-6 text-gray-600">Loading shutdowns...</div>
        ) : shutdowns.length === 0 ? (
          <div className="p-6 text-gray-600">No shutdowns created.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-t border-gray-200 text-sm">
              <thead className="bg-white">
                <tr>
                  <th className="text-left px-4 py-3 border-b border-gray-200">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 border-b border-gray-200">
                    Start
                  </th>
                  <th className="text-left px-4 py-3 border-b border-gray-200">
                    End
                  </th>
                  <th className="text-center px-4 py-3 border-b border-gray-200">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {shutdowns.map((s) => (
                  <tr key={s._id} className="bg-white">
                    <td className="px-4 py-3 border-b border-gray-200">
                      {s.type === "SINGLE_DAY" ? "Single day" : "Range"}
                    </td>
                    <td className="px-4 py-3 border-b border-gray-200">
                      {formatDate(s.startDate)}
                    </td>
                    <td className="px-4 py-3 border-b border-gray-200">
                      {formatDate(s.endDate)}
                    </td>
                    <td className="px-4 py-3 border-b border-gray-200 text-center">
                      <button
                        className="text-red-600 hover:underline disabled:text-gray-400"
                        onClick={() => handleDelete(s._id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

