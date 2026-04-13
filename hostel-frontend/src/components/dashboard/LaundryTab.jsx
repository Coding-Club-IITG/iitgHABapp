import React, { useState, useEffect } from "react";
import { getLaundryDashboard } from "../../apis/laundryApi";
import Card from "../ui/Card";

const LaundryTab = () => {
  const [laundryDashboard, setLaundryDashboard] = useState(null);
  const [laundryLoading, setLaundryLoading] = useState(false);
  const [laundryError, setLaundryError] = useState("");
  const [laundrySelectedMonth, setLaundrySelectedMonth] = useState("");

  const fetchLaundryDashboard = async () => {
    try {
      setLaundryError("");
      setLaundryLoading(true);
      const data = await getLaundryDashboard();
      setLaundryDashboard(data);
      const byMonth = data?.stats?.byMonth ?? [];
      if (byMonth.length === 0) {
        setLaundrySelectedMonth("");
      } else if (!laundrySelectedMonth || !byMonth.some((m) => m.yearMonth === laundrySelectedMonth)) {
        setLaundrySelectedMonth(byMonth[0].yearMonth);
      }
    } catch (err) {
      setLaundryError(err.response?.data?.message || "Failed to load laundry dashboard");
      setLaundryDashboard(null);
    } finally {
      setLaundryLoading(false);
    }
  };

  useEffect(() => {
    fetchLaundryDashboard();
  }, []);

  return (
    <Card>
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Laundry Service</h2>
        {laundryLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : laundryError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {laundryError}
          </div>
        ) : !laundryDashboard ? null : (
          <>
            {!laundryDashboard.isLaundryAvailable && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                Laundry service is not enabled for this hostel.
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Scan QR at laundry</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Students scan this QR in the app to avail free laundry (1 per 2 weeks).
                </p>
                {laundryDashboard.qrPayload && (
                  <div className="inline-block p-3 bg-white border border-gray-200 rounded-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                        laundryDashboard.qrPayload
                      )}`}
                      alt="Laundry QR"
                      className="w-[200px] h-[200px]"
                    />
                  </div>
                )}
              </div>
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly usage</h3>
                {laundryDashboard.stats?.byMonth?.length > 0 ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-gray-500">Month</label>
                    <select
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                      value={laundrySelectedMonth}
                      onChange={(e) => setLaundrySelectedMonth(e.target.value)}
                    >
                      {laundryDashboard.stats.byMonth.map((m) => (
                        <option key={m.yearMonth} value={m.yearMonth}>
                          {new Date(m.year, m.month - 1, 1).toLocaleString("default", {
                            month: "long",
                            year: "numeric",
                          })}
                        </option>
                      ))}
                    </select>
                    <div className="flex justify-between text-sm pt-1">
                      <span className="text-gray-600">Total monthly usage</span>
                      <span className="font-semibold text-gray-900">
                        {laundryDashboard.stats.byMonth.find(
                          (m) => m.yearMonth === laundrySelectedMonth
                        )?.count ?? 0}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No laundry scans yet.</p>
                )}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent laundry logs</h3>
              {!laundryDashboard.logs?.length ? (
                <p className="text-sm text-gray-500">No laundry usage yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-200 px-3 py-2 text-left">Date & time</th>
                        <th className="border border-gray-200 px-3 py-2 text-left">Name</th>
                        <th className="border border-gray-200 px-3 py-2 text-left">Roll number</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laundryDashboard.logs.map((row) => (
                        <tr key={row._id}>
                          <td className="border border-gray-200 px-3 py-2 text-gray-700">
                            {row.usedAt ? new Date(row.usedAt).toLocaleString() : "—"}
                          </td>
                          <td className="border border-gray-200 px-3 py-2">{row.userName ?? "—"}</td>
                          <td className="border border-gray-200 px-3 py-2">
                            {row.rollNumber ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default LaundryTab;
