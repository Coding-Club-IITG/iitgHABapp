import React, { useState, useEffect } from "react";
import { getBoarders } from "../../apis/hostelApi";
import Card from "../ui/Card";

const BoardersTab = () => {
  const [boarders, setBoarders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchBoarders = async () => {
    try {
      setLoading(true);
      const data = await getBoarders();
      setBoarders(data);
    } catch (err) {
      setError("Failed to fetch boarders: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoarders();
  }, []);

  const filteredBoarders = boarders.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = String(b.name ?? "").toLowerCase();
    const rollNumber = String(b.rollNumber ?? "").toLowerCase();
    const roomNumber = String(b.roomNumber ?? "").toLowerCase();
    const email = String(b.email ?? "").toLowerCase();
    return (
      name.includes(q) ||
      rollNumber.includes(q) ||
      roomNumber.includes(q) ||
      email.includes(q)
    );
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Boarders</h2>
        {filteredBoarders.length > 0 && (
          <button
            onClick={() => {
              const title = "Hostel Boarders";
              const headers = [
                "Sl. No.",
                "Name",
                "Roll Number",
                "Email",
                "Phone Number",
                "Room Number",
                "Degree",
              ];
              const rows = filteredBoarders.map((b, idx) => [
                String(idx + 1),
                b.name || "",
                b.rollNumber || "",
                b.email || "",
                b.phoneNumber || "",
                b.roomNumber || "",
                b.degree || "",
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

      <div className="mb-4 flex justify-end">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full sm:w-64 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        />
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
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-4 py-2 text-left">Sl. No.</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Roll Number</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Email</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Phone Number</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Room Number</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Degree</th>
              </tr>
            </thead>
            <tbody>
              {filteredBoarders.map((boarder, idx) => (
                <tr key={boarder._id}>
                  <td className="border border-gray-300 px-4 py-2">{idx + 1}</td>
                  <td className="border border-gray-300 px-4 py-2">{boarder.name}</td>
                  <td className="border border-gray-300 px-4 py-2">{boarder.rollNumber}</td>
                  <td className="border border-gray-300 px-4 py-2">{boarder.email}</td>
                  <td className="border border-gray-300 px-4 py-2">{boarder.phoneNumber}</td>
                  <td className="border border-gray-300 px-4 py-2">{boarder.roomNumber}</td>
                  <td className="border border-gray-300 px-4 py-2">{boarder.degree}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default BoardersTab;
