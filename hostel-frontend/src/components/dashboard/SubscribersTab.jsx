import React, { useState, useEffect } from "react";
import { getMessSubscribers } from "../../apis/hostelApi";
import Card from "../ui/Card";

const SubscribersTab = ({ user }) => {
  const [messSubscribers, setMessSubscribers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchMessSubscribers = async () => {
    try {
      setLoading(true);
      const data = await getMessSubscribers();
      setMessSubscribers(data);
    } catch (err) {
      setError("Failed to fetch mess subscribers: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessSubscribers();
  }, []);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Mess Subscribers</h2>
        {messSubscribers.length > 0 && (
          <button
            onClick={() => {
              const title = "Mess Subscribers";
              const headers = [
                "Name",
                "Roll Number",
                "Current Hostel",
                "Subscribed Mess",
                "Phone Number",
              ];
              const rows = messSubscribers.map((s) => [
                s.name || "",
                s.rollNumber || "",
                s.currentHostel || "",
                s.currentSubscribedMess || "",
                s.phoneNumber || "",
              ]);
              const win = window.open("", "_blank");
              if (!win) return;
              win.document.write(`
                <html>
                  <head>
                    <title>${title}</title>
                    <style>
                      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; }
                      h1 { font-size: 20px; margin-bottom: 16px; }
                      table { border-collapse: collapse; width: 100%; font-size: 12px; }
                      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
                      th { background: #f3f4f6; }
                    </style>
                  </head>
                  <body>
                    <h1>${title}</h1>
                    <table>
                      <thead>
                        <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
                      </thead>
                      <tbody>
                        ${rows
                          .map(
                            (r) =>
                              `<tr>${r
                                .map(
                                  (c) =>
                                    `<td>${String(c || "")
                                      .replace(/&/g, "&amp;")
                                      .replace(/</g, "&lt;")
                                      .replace(/>/g, "&gt;")}</td>`
                                )
                                .join("")}</tr>`
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </body>
                </html>
              `);
              win.document.close();
              win.focus();
              win.print();
            }}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Download PDF
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Caterer</div>
              <div className="mt-1 text-base font-semibold text-gray-900">
                {user?.hostel_name || "Hostel"} Mess
              </div>
            </div>
            {Array.isArray(messSubscribers) && messSubscribers.length > 0 && (
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Rating</div>
                  <div className="mt-1 text-base font-semibold text-gray-900">
                    {messSubscribers[0].rating ?? "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Ranking</div>
                  <div className="mt-1 text-base font-semibold text-gray-900">
                    {messSubscribers[0].ranking ?? "N/A"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Roll Number</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Current Hostel</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Subscribed Mess</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Phone Number</th>
                </tr>
              </thead>
              <tbody>
                {messSubscribers.map((sub) => (
                  <tr key={sub._id} className={sub.isDifferentHostel ? "bg-yellow-50" : ""}>
                    <td className="border border-gray-300 px-4 py-2">{sub.name}</td>
                    <td className="border border-gray-300 px-4 py-2">{sub.rollNumber}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      {sub.currentHostel}
                      {sub.isDifferentHostel && (
                        <span className="ml-2 text-yellow-600">⚠️</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">{sub.currentSubscribedMess}</td>
                    <td className="border border-gray-300 px-4 py-2">{sub.phoneNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
};

export default SubscribersTab;
