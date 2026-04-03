import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthProvider";
import { API_BASE_URL } from "../apis";
import axios from "axios";
import {
  Users,
  FileText,
  UserCheck,
  Building2,
  LogOut,
  Pencil,
  X,
  Shirt,
} from "lucide-react";
// NotificationSender and notification tab hidden for now
import Card from "../components/ui/Card";
import Tabs from "../components/ui/Tabs";
import Button from "../components/ui/Button";
import MessBillCalculator from "../components/MessBillCalculator";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("boarders");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // State for different sections
  const [boarders, setBoarders] = useState([]);
  const [messSubscribers, setMessSubscribers] = useState([]);
  const [smcMembers, setSmcMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cleaners, setCleaners] = useState([]);
  const [newCleanerName, setNewCleanerName] = useState("");
  const [newCleanerSlots, setNewCleanerSlots] = useState([]);
  const [cleanerFormOpen, setCleanerFormOpen] = useState(false);
  const [editingCleanerId, setEditingCleanerId] = useState(null);
  const [selectedCleanerId, setSelectedCleanerId] = useState("");

  const [bookingsDate, setBookingsDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [rcBookings, setRcBookings] = useState([]);
  const [rcBookingsLoading, setRcBookingsLoading] = useState(false);
  const [rcBookingsError, setRcBookingsError] = useState("");

  const [smcSearch, setSmcSearch] = useState("");

  const [laundryDashboard, setLaundryDashboard] = useState(null);
  const [laundryLoading, setLaundryLoading] = useState(false);
  const [laundryError, setLaundryError] = useState("");
  const [laundrySelectedMonth, setLaundrySelectedMonth] = useState("");

  // Fetch boarders
  const fetchBoarders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/hostel/boarders`);
      setBoarders(response.data.boarders || []);
    } catch (err) {
      setError("Failed to fetch boarders: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch mess subscribers
  const fetchMessSubscribers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/hostel/mess-subscribers`
      );
      setMessSubscribers(response.data.subscribers || []);
    } catch (err) {
      setError("Failed to fetch mess subscribers: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch SMC members
  const fetchSMCMembers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/hostel/smc-members`);
      setSmcMembers(response.data.smcMembers || []);
    } catch (err) {
      setError("Failed to fetch SMC members: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Room cleaners CRUD
  const fetchCleaners = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/room-cleaning/rc/cleaners`
      );
      setCleaners(response.data.cleaners || []);
    } catch (err) {
      setError(
        "Failed to fetch room cleaners: " +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCleaner = async () => {
    if (!newCleanerName.trim() || newCleanerSlots.length === 0) {
      alert("Please enter a name and select at least one slot.");
      return;
    }
    try {
      setLoading(true);
      if (editingCleanerId) {
        await axios.put(
          `${API_BASE_URL}/room-cleaning/rc/cleaners/${editingCleanerId}`,
          {
            name: newCleanerName.trim(),
            slots: newCleanerSlots,
          }
        );
      } else {
        await axios.post(`${API_BASE_URL}/room-cleaning/rc/cleaners`, {
          name: newCleanerName.trim(),
          slots: newCleanerSlots,
        });
      }
      await fetchCleaners();
      closeCleanerForm();
    } catch (err) {
      alert(
        `Failed to ${editingCleanerId ? "update" : "create"} cleaner: ` +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleNewCleanerSlot = (slot) => {
    setNewCleanerSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  const openAddCleanerForm = () => {
    setEditingCleanerId(null);
    setNewCleanerName("");
    setNewCleanerSlots([]);
    setCleanerFormOpen(true);
  };

  const openEditCleanerForm = (cleaner) => {
    setEditingCleanerId(cleaner?._id || null);
    setNewCleanerName(cleaner?.name || "");
    setNewCleanerSlots(Array.isArray(cleaner?.slots) ? cleaner.slots : []);
    setCleanerFormOpen(true);
  };

  const closeCleanerForm = () => {
    setCleanerFormOpen(false);
    setEditingCleanerId(null);
    setNewCleanerName("");
    setNewCleanerSlots([]);
  };

  const fetchLaundryDashboard = async () => {
    try {
      setLaundryError("");
      setLaundryLoading(true);
      const resp = await axios.get(`${API_BASE_URL}/laundry/hostel/dashboard`);
      setLaundryDashboard(resp.data);
      const byMonth = resp.data?.stats?.byMonth ?? [];
      if (byMonth.length === 0) {
        setLaundrySelectedMonth("");
      } else if (
        !laundrySelectedMonth ||
        !byMonth.some((m) => m.yearMonth === laundrySelectedMonth)
      ) {
        setLaundrySelectedMonth(byMonth[0].yearMonth);
      }
    } catch (err) {
      setLaundryError(
        err.response?.data?.message || "Failed to load laundry dashboard"
      );
      setLaundryDashboard(null);
    } finally {
      setLaundryLoading(false);
    }
  };

  const fetchBookingsForDate = async (dateStr) => {
    try {
      setRcBookingsError("");
      setRcBookingsLoading(true);
      const resp = await axios.get(`${API_BASE_URL}/room-cleaning/rc/tomorrow`, {
        params: { date: dateStr },
      });
      setRcBookings(resp.data?.bookings || []);
    } catch (err) {
      setRcBookingsError(
        "Failed to fetch room-cleaning bookings: " +
          (err.response?.data?.message || err.message)
      );
      setRcBookings([]);
    } finally {
      setRcBookingsLoading(false);
    }
  };

  const handleDeleteCleaner = async (id) => {
    if (!window.confirm("Delete this cleaner? Existing bookings remain.")) {
      return;
    }
    try {
      setLoading(true);
      await axios.delete(`${API_BASE_URL}/room-cleaning/rc/cleaners/${id}`);
      await fetchCleaners();
    } catch (err) {
      alert(
        "Failed to delete cleaner: " +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  // Mark user as SMC
  const markAsSMC = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Not authenticated. Please login again.");
        return;
      }
      await axios.post(
        `${API_BASE_URL}/hostel/mark-smc`,
        { userId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      await fetchSMCMembers();
      await fetchBoarders();
    } catch (err) {
      console.error("Error marking as SMC:", err);
      alert(
        "Failed to mark user as SMC: " +
          (err.response?.data?.message || err.message)
      );
    }
  };

  // Unmark user as SMC
  const unmarkAsSMC = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Not authenticated. Please login again.");
        return;
      }
      await axios.post(
        `${API_BASE_URL}/hostel/unmark-smc`,
        { userId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      await fetchSMCMembers();
      await fetchBoarders();
    } catch (err) {
      console.error("Error unmarking as SMC:", err);
      alert(
        "Failed to unmark user as SMC: " +
          (err.response?.data?.message || err.message)
      );
    }
  };

  useEffect(() => {
    if (activeTab === "boarders") {
      fetchBoarders();
    } else if (activeTab === "subscribers") {
      fetchMessSubscribers();
    } else if (activeTab === "smc") {
      fetchSMCMembers();
    } else if (activeTab === "cleaners") {
      fetchCleaners();
      fetchBookingsForDate(bookingsDate);
    } else if (activeTab === "laundry") {
      fetchLaundryDashboard();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "cleaners") return;
    if (selectedCleanerId) return;
    if (cleaners.length > 0) setSelectedCleanerId(cleaners[0]._id);
  }, [activeTab, cleaners, selectedCleanerId]);

  useEffect(() => {
    if (activeTab !== "cleaners") return;
    fetchBookingsForDate(bookingsDate);
  }, [activeTab, bookingsDate]);

  const selectedCleaner =
    cleaners.find((c) => c._id === selectedCleanerId) || null;

  const dateOptions = (() => {
    const opts = [];
    const base = new Date();
    for (let i = -2; i <= 5; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const value = `${yyyy}-${mm}-${dd}`;
      const label =
        i === 0 ? `Today (${value})` : i === 1 ? `Tomorrow (${value})` : value;
      opts.push({ value, label });
    }
    if (!opts.some((o) => o.value === bookingsDate)) {
      opts.unshift({ value: bookingsDate, label: bookingsDate });
    }
    return opts;
  })();

  const bookingsForCleaner = selectedCleanerId
    ? rcBookings.filter((b) => String(b.assignedTo || "") === selectedCleanerId)
    : [];

  const tabItems = [
    { label: "Boarders", value: "boarders", icon: Users },
    { label: "Mess Subscribers", value: "subscribers", icon: Building2 },
    { label: "SMC Management", value: "smc", icon: UserCheck },
    { label: "Room Cleaners", value: "cleaners", icon: Users },
    { label: "Laundry", value: "laundry", icon: Shirt },
  ];

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <div className="w-full p-6">
        <div className="flex gap-6 w-full">
          {/* Sidebar */}
          <aside
            style={{
              height: "calc(100vh - 48px)",
              position: "sticky",
              top: "24px",
            }}
            className={`bg-white border border-gray-100 rounded-lg shadow-sm p-3 transition-all duration-200 ${
              sidebarOpen ? "w-72" : "w-16"
            }`}
          >
            <div
              className={`flex items-center ${
                sidebarOpen ? "justify-between" : "justify-center"
              } mb-6`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen((v) => !v)}
                  className="p-2 rounded-md hover:bg-gray-100"
                  title={sidebarOpen ? "Collapse" : "Expand"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-gray-700"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                {sidebarOpen && (
                  <div>
                    <h2 className="text-lg font-semibold">
                      {user?.hostel_name || "Hostel"}
                    </h2>
                    <p className="text-xs text-gray-500">Hostel Office</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {tabItems.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`flex items-center ${
                      sidebarOpen
                        ? "gap-3 px-3 mx-1"
                        : "justify-center px-0 mx-0"
                    } w-full py-2 rounded-md ${
                      activeTab === tab.value
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {sidebarOpen && <span>{tab.label}</span>}
                  </button>
                );
              })}
            </div>
            <div
              className={
                sidebarOpen
                  ? "mt-auto px-2 pt-4 border-t border-gray-100"
                  : "mt-auto flex justify-center pt-4 border-t border-gray-100"
              }
            >
              <button
                onClick={() => logout()}
                className={
                  sidebarOpen
                    ? "w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-100 rounded-md py-2 text-sm transition-colors"
                    : "w-10 h-10 flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                }
              >
                <LogOut className="w-5 h-5" />
                {sidebarOpen && <span>Logout</span>}
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 w-full">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {activeTab === "boarders" && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Boarders</h2>
                  {boarders.length > 0 && (
                    <button
                      onClick={() => {
                        const title = "Hostel Boarders";
                        const headers = [
                          "Name",
                          "Roll Number",
                          "Email",
                          "Phone Number",
                          "Room Number",
                          "Degree",
                        ];
                        const rows = boarders.map((b) => [
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
                                  <tr>${headers
                                    .map((h) => `<th>${h}</th>`)
                                    .join("")}</tr>
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
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-300">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border border-gray-300 px-4 py-2 text-left">
                            Name
                          </th>
                          <th className="border border-gray-300 px-4 py-2 text-left">
                            Roll Number
                          </th>
                          <th className="border border-gray-300 px-4 py-2 text-left">
                            Email
                          </th>
                          <th className="border border-gray-300 px-4 py-2 text-left">
                            Phone Number
                          </th>
                          <th className="border border-gray-300 px-4 py-2 text-left">
                            Room Number
                          </th>
                          <th className="border border-gray-300 px-4 py-2 text-left">
                            Degree
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {boarders.map((boarder) => (
                          <tr key={boarder._id}>
                            <td className="border border-gray-300 px-4 py-2">
                              {boarder.name}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {boarder.rollNumber}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {boarder.email}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {boarder.phoneNumber}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {boarder.roomNumber}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {boarder.degree}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {activeTab === "subscribers" && (
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
                                  <tr>${headers
                                    .map((h) => `<th>${h}</th>`)
                                    .join("")}</tr>
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
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Caterer info summary for this mess */}
                    <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">
                          Caterer
                        </div>
                        <div className="mt-1 text-base font-semibold text-gray-900">
                          {user?.hostel_name || "Hostel"} Mess
                        </div>
                      </div>
                      {Array.isArray(messSubscribers) &&
                        messSubscribers.length > 0 && (
                          <div className="flex items-center gap-6">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-gray-500">
                                Rating
                              </div>
                              <div className="mt-1 text-base font-semibold text-gray-900">
                                {messSubscribers[0].rating ?? "N/A"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-gray-500">
                                Ranking
                              </div>
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
                            <th className="border border-gray-300 px-4 py-2 text-left">
                              Name
                            </th>
                            <th className="border border-gray-300 px-4 py-2 text-left">
                              Roll Number
                            </th>
                            <th className="border border-gray-300 px-4 py-2 text-left">
                              Current Hostel
                            </th>
                            <th className="border border-gray-300 px-4 py-2 text-left">
                              Subscribed Mess
                            </th>
                            <th className="border border-gray-300 px-4 py-2 text-left">
                              Phone Number
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {messSubscribers.map((sub) => (
                            <tr
                              key={sub._id}
                              className={
                                sub.isDifferentHostel ? "bg-yellow-50" : ""
                              }
                            >
                              <td className="border border-gray-300 px-4 py-2">
                                {sub.name}
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                {sub.rollNumber}
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                {sub.currentHostel}
                                {sub.isDifferentHostel && (
                                  <span className="ml-2 text-yellow-600">
                                    ⚠️
                                  </span>
                                )}
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                {sub.currentSubscribedMess}
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                {sub.phoneNumber}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {activeTab === "cleaners" && (
              <Card>
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                      Room Cleaners
                    </h2>
                    <Button onClick={openAddCleanerForm} disabled={loading}>
                      Add Cleaner
                    </Button>
                  </div>

                  {cleanerFormOpen && (
                    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">
                          {editingCleanerId ? "Edit Cleaner" : "Add New Cleaner"}
                        </h3>
                        <button
                          onClick={closeCleanerForm}
                          className="p-2 rounded-md hover:bg-gray-100"
                          title="Close"
                        >
                          <X className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>

                      <div className="flex flex-col md:flex-row md:items-end gap-4">
                        <div className="w-full md:flex-1 min-w-[220px]">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Cleaner name
                          </label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                            placeholder="Cleaner name"
                            value={newCleanerName}
                            onChange={(e) => setNewCleanerName(e.target.value)}
                          />
                        </div>

                        <div className="w-full md:flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Slots
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {["A", "B", "C", "D"].map((slot) => (
                              <label
                                key={slot}
                                className="flex items-center gap-2 text-sm text-gray-700"
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={newCleanerSlots.includes(slot)}
                                  onChange={() => toggleNewCleanerSlot(slot)}
                                />
                                <span>Slot {slot}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="w-full md:w-auto flex items-center md:justify-end gap-2">
                          <Button
                            onClick={handleSubmitCleaner}
                            disabled={loading}
                            className="w-full md:w-auto"
                          >
                            {editingCleanerId ? "Save Cleaner" : "Create Cleaner"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={closeCleanerForm}
                            disabled={loading}
                            className="w-full md:w-auto"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {loading && cleaners.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                  ) : cleaners.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      No cleaners configured yet. Click “Add Cleaner” to create
                      the first cleaner.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Select cleaner
                          </label>
                          <select
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                            value={selectedCleanerId}
                            onChange={(e) => setSelectedCleanerId(e.target.value)}
                          >
                            {cleaners.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {selectedCleaner && (
                        <div className="border border-gray-200 rounded-lg p-4 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-gray-800">
                                {selectedCleaner.name}
                              </div>
                              <div className="text-xs text-gray-600">
                                Slots:{" "}
                                {Array.isArray(selectedCleaner.slots) &&
                                selectedCleaner.slots.length > 0
                                  ? selectedCleaner.slots
                                      .slice()
                                      .sort()
                                      .join(", ")
                                  : "—"}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditCleanerForm(selectedCleaner)}
                                disabled={loading}
                                className="gap-2"
                              >
                                <Pencil className="w-4 h-4" />
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteCleaner(selectedCleaner._id)}
                                disabled={loading}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-800">
                              Assigned bookings
                            </div>
                            <div className="text-xs text-gray-600">
                              Shows bookings assigned to the selected cleaner for the chosen date.
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-gray-600">
                              Date
                            </label>
                            <select
                              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                              value={bookingsDate}
                              onChange={(e) => setBookingsDate(e.target.value)}
                            >
                              {dateOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {rcBookingsLoading ? (
                          <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
                          </div>
                        ) : rcBookingsError ? (
                          <p className="text-sm text-red-600">{rcBookingsError}</p>
                        ) : !selectedCleanerId ? (
                          <p className="text-sm text-gray-600">
                            Select a cleaner to view bookings.
                          </p>
                        ) : bookingsForCleaner.length === 0 ? (
                          <p className="text-sm text-gray-600">
                            No bookings assigned to this cleaner for {bookingsDate}.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full border border-gray-200 text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="border border-gray-200 px-3 py-2 text-left">
                                    Room
                                  </th>
                                  <th className="border border-gray-200 px-3 py-2 text-left">
                                    Slot
                                  </th>
                                  <th className="border border-gray-200 px-3 py-2 text-left">
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {bookingsForCleaner.map((b) => (
                                  <tr key={b._id}>
                                    <td className="border border-gray-200 px-3 py-2">
                                      {b.roomNumber || "—"}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2">
                                      {b.timeRange || `Slot ${b.slot || "—"}`}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2">
                                      {b.status || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {activeTab === "laundry" && (
              <Card>
                <div className="p-6 space-y-6">
                  <h2 className="text-2xl font-bold text-gray-800">
                    Laundry Service
                  </h2>
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
                          <h3 className="text-sm font-semibold text-gray-700 mb-3">
                            Scan QR at laundry
                          </h3>
                          <p className="text-xs text-gray-500 mb-3">
                            Students scan this QR in the app to avail free laundry (1 per 2 weeks).
                          </p>
                          {laundryDashboard.qrPayload && (
                            <div className="inline-block p-3 bg-white border border-gray-200 rounded-lg">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(laundryDashboard.qrPayload)}`}
                                alt="Laundry QR"
                                className="w-[200px] h-[200px]"
                              />
                            </div>
                          )}
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4 bg-white">
                          <h3 className="text-sm font-semibold text-gray-700 mb-3">
                            Monthly usage
                          </h3>
                          {laundryDashboard.stats?.byMonth?.length > 0 ? (
                            <div className="space-y-3">
                              <label className="block text-xs font-medium text-gray-500">
                                Month
                              </label>
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
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
                          Recent laundry logs
                        </h3>
                        {!laundryDashboard.logs?.length ? (
                          <p className="text-sm text-gray-500">No laundry usage yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full border border-gray-200 text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="border border-gray-200 px-3 py-2 text-left">
                                    Date & time
                                  </th>
                                  <th className="border border-gray-200 px-3 py-2 text-left">
                                    Name
                                  </th>
                                  <th className="border border-gray-200 px-3 py-2 text-left">
                                    Roll number
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {laundryDashboard.logs.map((row) => (
                                  <tr key={row._id}>
                                    <td className="border border-gray-200 px-3 py-2 text-gray-700">
                                      {row.usedAt
                                        ? new Date(row.usedAt).toLocaleString()
                                        : "—"}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2">
                                      {row.userName ?? "—"}
                                    </td>
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
            )}

            {activeTab === "smc" && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">SMC Management</h2>
                  <input
                    type="text"
                    value={smcSearch}
                    onChange={(e) => setSmcSearch(e.target.value)}
                    placeholder="Search by name or roll..."
                    className="w-64 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        Current SMC Members
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border border-gray-300">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="border border-gray-300 px-4 py-2 text-left">
                                Name
                              </th>
                              <th className="border border-gray-300 px-4 py-2 text-left">
                                Roll Number
                              </th>
                              <th className="border border-gray-300 px-4 py-2 text-left">
                                Room Number
                              </th>
                              <th className="border border-gray-300 px-4 py-2 text-left">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {smcMembers
                              .filter((member) => {
                                if (!smcSearch.trim()) return true;
                                const q = smcSearch.toLowerCase();
                                return (
                                  member.name?.toLowerCase().includes(q) ||
                                  member.rollNumber?.toLowerCase().includes(q)
                                );
                              })
                              .map((member) => (
                              <tr key={member._id}>
                                <td className="border border-gray-300 px-4 py-2">
                                  {member.name}
                                </td>
                                <td className="border border-gray-300 px-4 py-2">
                                  {member.rollNumber}
                                </td>
                                <td className="border border-gray-300 px-4 py-2">
                                  {member.roomNumber}
                                </td>
                                <td className="border border-gray-300 px-4 py-2">
                                  <Button
                                    onClick={() => unmarkAsSMC(member._id)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    Remove SMC
                                  </Button>
                                </td>
                              </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        All Boarders
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border border-gray-300">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="border border-gray-300 px-4 py-2 text-left">
                                Name
                              </th>
                              <th className="border border-gray-300 px-4 py-2 text-left">
                                Roll Number
                              </th>
                              <th className="border border-gray-300 px-4 py-2 text-left">
                                Room Number
                              </th>
                              <th className="border border-gray-300 px-4 py-2 text-left">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {boarders
                              .filter((b) => {
                                const notSmc = !smcMembers.find(
                                  (smc) => smc._id === b._id
                                );
                                if (!notSmc) return false;
                                if (!smcSearch.trim()) return true;
                                const q = smcSearch.toLowerCase();
                                return (
                                  b.name?.toLowerCase().includes(q) ||
                                  b.rollNumber?.toLowerCase().includes(q)
                                );
                              })
                              .map((boarder) => (
                                <tr key={boarder._id}>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {boarder.name}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {boarder.rollNumber}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {boarder.roomNumber}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2">
                                    <Button
                                      onClick={() => markAsSMC(boarder._id)}
                                      className="bg-blue-500 hover:bg-blue-600"
                                    >
                                      Mark as SMC
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
