import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  getCatererInfo,
  getMessSubscribers,
  getMessSubscribersSnapshotMonths,
} from "../../apis/hostelApi";
import Card from "../ui/Card";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthYearLabel(month, year) {
  return `${MONTH_SHORT[month - 1] || month} ${year}`;
}

function buildMonthOptions(currentMonth, currentYear, snapshots) {
  const d = new Date();
  const cm = currentMonth ?? d.getMonth() + 1;
  const cy = currentYear ?? d.getFullYear();
  const opts = [
    {
      value: "live",
      label: monthYearLabel(cm, cy),
    },
  ];
  const seen = new Set();
  for (const s of snapshots || []) {
    const key = `${s.year}-${s.month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    opts.push({
      value: `${s.year}-${String(s.month).padStart(2, "0")}`,
      label: monthYearLabel(s.month, s.year),
    });
  }
  return opts;
}

const SubscribersTab = ({ user }) => {
  const [messSubscribers, setMessSubscribers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [catererInfo, setCatererInfo] = useState(null);

  const [monthMeta, setMonthMeta] = useState(() => {
    const d = new Date();
    return {
      currentMonth: d.getMonth() + 1,
      currentYear: d.getFullYear(),
      snapshots: [],
    };
  });
  const [selectedMonthKey, setSelectedMonthKey] = useState("live");

  const monthOptions = useMemo(
    () =>
      buildMonthOptions(
        monthMeta.currentMonth,
        monthMeta.currentYear,
        monthMeta.snapshots,
      ),
    [monthMeta.currentMonth, monthMeta.currentYear, monthMeta.snapshots],
  );

  const fetchMonthList = useCallback(async () => {
    try {
      const data = await getMessSubscribersSnapshotMonths();
      setMonthMeta({
        currentMonth: data.currentMonth,
        currentYear: data.currentYear,
        snapshots: data.snapshots || [],
      });
    } catch (err) {
      console.error("Failed to fetch snapshot months:", err);
    }
  }, []);

  const fetchMessSubscribers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      let data;
      if (selectedMonthKey === "live") {
        data = await getMessSubscribers();
      } else {
        const parts = selectedMonthKey.split("-");
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        data = await getMessSubscribers({
          month: m,
          year: y,
          snapshot: true,
        });
      }
      setMessSubscribers(data.subscribers || []);
    } catch (err) {
      setError("Failed to fetch mess subscribers: " + err.message);
      setMessSubscribers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonthKey]);

  useEffect(() => {
    fetchMonthList();
  }, [fetchMonthList]);

  useEffect(() => {
    fetchMessSubscribers();
  }, [fetchMessSubscribers]);

  useEffect(() => {
    const fetchCaterer = async () => {
      try {
        const info = await getCatererInfo();
        setCatererInfo(info);
      } catch (err) {
        console.error("Failed to fetch caterer info:", err);
      }
    };
    fetchCaterer();
  }, []);

  const filteredSubscribers = messSubscribers.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = String(s.name ?? "").toLowerCase();
    const rollNumber = String(s.rollNumber ?? "").toLowerCase();
    return name.includes(q) || rollNumber.includes(q);
  });

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-4">Mess</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Caterer</div>
            <div className="mt-1 text-base font-semibold text-gray-900">
              {catererInfo?.catererName || `${user?.hostel_name || "Hostel"} Mess`}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Rating</div>
              <div className="mt-1 text-base font-semibold text-gray-900">
                {catererInfo?.rating ?? "N/A"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Ranking</div>
              <div className="mt-1 text-base font-semibold text-gray-900">
                {catererInfo?.ranking ?? "N/A"}
              </div>
            </div>
          </div>
        </div>

        <div>
          <select
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            aria-label="Month or period"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white min-w-[min(100%,260px)]"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name / roll..."
                className="w-full sm:w-64 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left">Sl. No.</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Roll Number</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Current Hostel</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Subscribed Mess</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Phone Number</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscribers.map((sub, idx) => (
                    <tr key={sub._id} className={sub.isDifferentHostel ? "bg-yellow-50" : ""}>
                      <td className="border border-gray-300 px-4 py-2">{idx + 1}</td>
                      <td className="border border-gray-300 px-4 py-2">{sub.name}</td>
                      <td className="border border-gray-300 px-4 py-2">{sub.rollNumber}</td>
                      <td className="border border-gray-300 px-4 py-2">
                        {sub.currentHostel}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">{sub.currentSubscribedMess}</td>
                      <td className="border border-gray-300 px-4 py-2">{sub.phoneNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default SubscribersTab;
