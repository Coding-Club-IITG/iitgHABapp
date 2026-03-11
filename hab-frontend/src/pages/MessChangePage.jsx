import React, { useState, useEffect, useMemo } from "react";
import { Users, Zap, Play, Info, XCircle, Square } from "lucide-react";
import { BACKEND_URL } from "../apis/server";

const MessChangePage = () => {
  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [messChangeSettings, setMessChangeSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [hostels, setHostels] = useState([]);
  const [hostelsLoading, setHostelsLoading] = useState(false);
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const buildHostelMap = (list) => {
    const map = {};
    (list || []).forEach((h) => {
      if (h && h._id) {
        map[String(h._id)] = h.hostel_name;
      }
    });
    return map;
  };

  const fetchRequests = async (hostelMapParam) => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/mess-change/all`, {
        headers: {
          ...authHeaders,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const hostelMap = hostelMapParam || buildHostelMap(hostels);
      const withNames = (data.data || []).map((req) => {
        const userHostelId = req.hostel;
        const userHostelIdStr = userHostelId ? String(userHostelId) : "";
        const pref1IdStr = req.next_mess1 ? String(req.next_mess1) : "";
        const pref2IdStr = req.next_mess2 ? String(req.next_mess2) : "";
        const pref3IdStr = req.next_mess3 ? String(req.next_mess3) : "";

        const preference1Name =
          hostelMap[pref1IdStr] || req.applied_hostel_string || "-";
        const preference2Name = hostelMap[pref2IdStr] || "-";
        const preference3Name = hostelMap[pref3IdStr] || "-";

        return {
          ...req,
          userHostelName: hostelMap[userHostelIdStr] || "Unknown",
          preference1Name,
          preference2Name,
          preference3Name,
        };
      });
      setRequests(withNames);
    } catch (error) {
      console.error("Error fetching requests:", error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessChangeSettings = async () => {
    try {
      setSettingsLoading(true);
      const response = await fetch(`${BACKEND_URL}/mess-change/settings`, {
        headers: {
          ...authHeaders,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMessChangeSettings(data.data);
    } catch (error) {
      console.error("Error fetching mess change settings:", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchHostels = async () => {
    try {
      setHostelsLoading(true);
      const response = await fetch(`${BACKEND_URL}/hostel/all`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const list = Array.isArray(data)
        ? data
        : data?.hostels || data?.data || [];
      setHostels(list);
      return list;
    } catch (error) {
      console.error("Error fetching hostels:", error);
      setHostels([]);
      return [];
    } finally {
      setHostelsLoading(false);
    }
  };

  const fetchScheduleInfo = async () => {
    try {
      setScheduleLoading(true);
      const response = await fetch(`${BACKEND_URL}/mess-change/schedule`, {
        headers: {
          ...authHeaders,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setScheduleInfo(data.data);
    } catch (error) {
      console.error("Error fetching schedule info:", error);
      setScheduleInfo(null);
    } finally {
      setScheduleLoading(false);
    }
  };

  const enableMessChange = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/mess-change/enable`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();
      alert("Mess change enabled successfully!");
      await fetchMessChangeSettings();
    } catch (error) {
      console.error("Error enabling mess change:", error);
      alert("Failed to enable mess change. Please try again.");
    }
  };

  const disableMessChange = async () => {
    try {
      setSettingsLoading(true);
      const response = await fetch(`${BACKEND_URL}/mess-change/disable`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();
      alert("Mess change disabled successfully!");
      await fetchMessChangeSettings();
    } catch (error) {
      console.error("Error disabling mess change:", error);
      alert("Failed to disable mess change. Please try again.");
    } finally {
      setSettingsLoading(false);
    }
  };

  const processAllRequests = async () => {
    try {
      setProcessing(true);
      const response = await fetch(`${BACKEND_URL}/mess-change/process-all`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      alert(
        `Processing Complete!\nAccepted: ${data.acceptedUsers.length}\nRejected: ${data.rejectedUsers.length}\n\n${data.message}`,
      );

      // Refresh the requests and settings
      await fetchRequests();
      await fetchMessChangeSettings();
    } catch (error) {
      console.error("Error processing requests:", error);
      alert("Failed to process requests. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const rejectAllRequests = async () => {
    if (!confirm("Are you sure you want to reject all pending requests?")) {
      return;
    }
    try {
      setRejecting(true);
      const response = await fetch(`${BACKEND_URL}/mess-change/reject-all`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      alert(data.message || "All pending requests rejected");
      await fetchRequests();
      await fetchMessChangeSettings();
      // Ensure UI reflects disabled state immediately
      window.location.reload();
    } catch (error) {
      console.error("Error rejecting all requests:", error);
      alert("Failed to reject requests. Please try again.");
    } finally {
      setRejecting(false);
    }
  };

  useEffect(() => {
    (async () => {
      const list = await fetchHostels();
      const hostelMap = buildHostelMap(list);
      await fetchRequests(hostelMap);
      await fetchMessChangeSettings();
      await fetchScheduleInfo();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeaders]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Mess Change Management
        </h1>
        <p className="text-gray-600">
          Control mess change functionality and process requests for all hostels
        </p>
      </div>
      {/* Mess Change Control Panel */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Mess Change Control
          </h2>
          {settingsLoading && (
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
        </div>

        {messChangeSettings && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Status</p>
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    messChangeSettings.isEnabled ? "bg-green-500" : "bg-red-500"
                  }`}
                ></div>
                <span
                  className={`font-semibold ${
                    messChangeSettings.isEnabled
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {messChangeSettings.isEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Last Processed
              </p>
              <p className="text-sm text-gray-600">
                {messChangeSettings.lastProcessedAt
                  ? new Date(messChangeSettings.lastProcessedAt).toLocaleString(
                      "en-IN",
                    )
                  : "Never"}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {!messChangeSettings?.isEnabled ? (
            <button
              onClick={enableMessChange}
              disabled={settingsLoading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors duration-200"
            >
              <Play className="w-4 h-4" />
              Enable Mess Change
            </button>
          ) : requests.length === 0 ? (
            <button
              onClick={disableMessChange}
              disabled={settingsLoading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors duration-200"
            >
              <Square className="w-4 h-4" />
              Disable
            </button>
          ) : (
            <>
              <button
                onClick={processAllRequests}
                disabled={processing || requests.length === 0}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors duration-200"
              >
                <Zap className="w-4 h-4" />
                {processing
                  ? "Processing..."
                  : `Process All Requests (${requests.length})`}
              </button>

              <button
                onClick={rejectAllRequests}
                disabled={rejecting || requests.length === 0}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors duration-200"
              >
                <XCircle className="w-4 h-4" />
                {rejecting ? "Rejecting..." : "Reject All Requests"}
              </button>
            </>
          )}
        </div>
      </div>
      {/* Automatic Schedule Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Automatic Schedule
          </h2>
          {scheduleLoading && (
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
        </div>

        {scheduleInfo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">
                🔄 Auto Enable
              </h3>
              <p className="text-sm text-blue-700 mb-1">
                {scheduleInfo.schedule.enablePattern}
              </p>
              <p className="text-xs text-blue-600">
                Next: {scheduleInfo.schedule.nextEnableDateIST}
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">
                ⏹️ Auto Disable
              </h3>
              <p className="text-sm text-blue-700 mb-1">
                {scheduleInfo.schedule.disablePattern}
              </p>
              <p className="text-xs text-blue-600">
                Next: {scheduleInfo.schedule.nextDisableDateIST}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-100 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Mess change is automatically managed by the
            system. Manual enable/disable buttons are provided for
            administrative overrides only.
          </p>
          {scheduleInfo && (
            <p className="text-xs text-blue-600 mt-1">
              Current IST time: {scheduleInfo.currentTimeIST}
            </p>
          )}
        </div>
      </div>
      {/* Pending Requests Table - Only show when mess change is enabled */}
      {messChangeSettings?.isEnabled && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Pending Requests
          </h2>

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-500 mt-2">Loading requests...</p>
            </div>
          )}

          {!loading && requests.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                No pending mess change requests found
              </p>
            </div>
          ) : (
            !loading && (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed bg-white border border-gray-200 rounded-lg shadow-sm text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="w-12 px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                        Sl. No
                      </th>
                      <th className="w-28 px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="w-24 px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                        Roll Number
                      </th>
                      <th className="w-24 px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                        Hostel
                      </th>
                      <th className="w-24 px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                        Preference 1
                      </th>
                      <th className="w-24 px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                        Preference 2
                      </th>
                      <th className="w-24 px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                        Preference 3
                      </th>
                      <th className="w-32 px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                        Applied At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {requests.map((request, index) => (
                      <tr
                        key={request._id}
                        className="hover:bg-gray-50 transition-colors duration-200"
                      >
                        <td className="px-3 py-2 text-gray-900 align-top">
                          {index + 1}
                        </td>
                        <td className="px-3 py-2 text-gray-900 align-top break-words">
                          {request.name}
                        </td>
                        <td className="px-3 py-2 text-gray-900 align-top break-words">
                          {request.rollNumber}
                        </td>
                        <td className="px-3 py-2 text-gray-900 align-top break-words">
                          {request.userHostelName}
                        </td>
                        <td className="px-3 py-2 text-gray-900 align-top break-words">
                          {request.preference1Name}
                        </td>
                        <td className="px-3 py-2 text-gray-900 align-top break-words">
                          {request.preference2Name}
                        </td>
                        <td className="px-3 py-2 text-gray-900 align-top break-words">
                          {request.preference3Name}
                        </td>
                        <td className="px-3 py-2 text-gray-500 align-top break-words">
                          {request.applied_hostel_timestamp
                            ? new Date(
                                request.applied_hostel_timestamp,
                              ).toLocaleString("en-IN", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default MessChangePage;
