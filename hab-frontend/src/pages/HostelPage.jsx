import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import HostelStats from "./stats/HostelStats";
import HostelUsersList from "../components/HostelUsersList";
import MessSubscribersList from "../components/MessSubscribersList";
import MessShutdowns from "../components/MessShutdowns";
import {
  getUnassignedMesses,
  assignMessToHostel,
  getMessById,
  unassignMess,
} from "../apis/mess";
import { getHostelById, getMessSubscribersByHostelId } from "../apis/hostel";

export default function HostelPage() {
  const { hostelId } = useParams();

  const [unassignedMess, setUnassignedMess] = useState([]);
  const [selectedMess, setSelectedMess] = useState("");
  const [hostel, setHostel] = useState(null);
  const [messDetails, setMessDetails] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("details"); // 'details' or 'bill'
  const [isAssigning, setIsAssigning] = useState(false);
  // const [isUnassigning, setIsUnassigning] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [subscribersData, setSubscribersData] = useState(null);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [isEditingCaterer, setIsEditingCaterer] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);

  useEffect(() => {
    const fetchUnassignedMess = async () => {
      try {
        const data = await getUnassignedMesses();
        setUnassignedMess(data);
      } catch (err) {
        console.error("Error fetching unassigned mess:", err);
        setError("Failed to fetch unassigned mess");
      }
    };

    fetchUnassignedMess();
  }, []);

  useEffect(() => {
    const fetchHostel = async () => {
      try {
        const data = await getHostelById(hostelId);
        // console.log("Hostel data received:", data);
        setHostel(data.hostel);

        // If hostel has a mess assigned, fetch full mess details
        if (data.hostel.messId) {
          // console.log("Mess ID found:", data.hostel.messId);
          try {
            const fullMessDetails = await getMessById(data.hostel.messId._id);
            // console.log("Full mess details:", fullMessDetails);
            setMessDetails(fullMessDetails);
          } catch (messError) {
            console.error("Error fetching mess details:", messError);
            // Fallback to basic mess info from hostel data with minimal required fields
            setMessDetails({
              _id: data.hostel.messId._id,
              name: data.hostel.messId.name,
              rating: 0,
              ranking: "N/A",
              complaints: [],
            });
          }
        } else {
          // console.log("No mess assigned to hostel");
          setMessDetails(null);
        }
      } catch (err) {
        console.error("Error fetching hostel:", err);
        setError("Could not load hostel data.");
      }
    };

    fetchHostel();
  }, [hostelId]);

  // Always keep subscribers count updated for details card
  useEffect(() => {
    const fetchSubscribersCount = async () => {
      try {
        const data = await getMessSubscribersByHostelId(hostelId);
        setSubscribersCount(data?.count || 0);
      } catch (err) {
        console.error("Error fetching mess subscribers count:", err);
        setSubscribersCount(0);
      }
    };
    if (hostelId) fetchSubscribersCount();
  }, [hostelId]);

  // Fetch mess subscribers when the tab is activated
  useEffect(() => {
    const fetchSubscribers = async () => {
      if (activeTab !== "subscribers") return;
      try {
        setLoadingSubscribers(true);
        const data = await getMessSubscribersByHostelId(hostelId);
        setSubscribersData(data);
      } catch (err) {
        console.error("Error fetching mess subscribers:", err);
      } finally {
        setLoadingSubscribers(false);
      }
    };
    fetchSubscribers();
  }, [activeTab, hostelId]);

  const handleCatererChange = async () => {
    setIsAssigning(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await assignMessToHostel(selectedMess, {
        hostelId: hostelId,
      });

      // Refresh the hostel and mess data
      const data = await getHostelById(hostelId);
      setHostel(data.hostel);

      if (data.hostel.messId) {
        const fullMessDetails = await getMessById(data.hostel.messId._id);
        setMessDetails(fullMessDetails);
      }

      // Refresh unassigned mess list
      const unassignedData = await getUnassignedMesses();
      setUnassignedMess(unassignedData);

      setSelectedMess(""); // Reset selection

      // Show success message
      setSuccessMessage("Caterer assigned successfully!");
      setError(null);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error assigning caterer:", err);
      setError("Failed to assign caterer.");
    } finally {
      setIsAssigning(false);
    }
  };

  // Unassign flow removed in simplified UI
  const handleUnassignCaterer = async () => {
    if (!hostel?.messId?._id) return;
    const confirm = window.confirm(
      `Unassign caterer "${hostel.messId.name}" from ${hostel.hostel_name}?`
    );
    if (!confirm) return;

    try {
      setIsUnassigning(true);
      setError(null);
      setSuccessMessage(null);

      await unassignMess(hostel.messId._id);

      // Refresh hostel data
      const data = await getHostelById(hostelId);
      setHostel(data.hostel);
      setMessDetails(null);

      // Refresh unassigned mess list (freed caterer becomes available)
      const unassignedData = await getUnassignedMesses();
      setUnassignedMess(unassignedData);

      setSelectedMess("");
      setIsEditingCaterer(false);

      setSuccessMessage("Caterer unassigned successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error unassigning caterer:", err);
      setError("Failed to unassign caterer.");
    } finally {
      setIsUnassigning(false);
    }
  };

  if (!hostel) {
    return <div className="p-6 text-gray-600">Loading hostel...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            {hostel.hostel_name}
          </h1>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("details")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "details"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Hostel Details
            </button>
            <button
              onClick={() => setActiveTab("boarders")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "boarders"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Boarders ({hostel.users?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("subscribers")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "subscribers"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Mess Subscribers ({subscribersCount})
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "stats"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Hostel Stats
            </button>
            <button
              onClick={() => setActiveTab("mess_shutdowns")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "mess_shutdowns"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Mess Shutdowns
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "details" && (
          <div className="space-y-6">
            {/* Stat tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Capacity
                </div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {hostel.curr_cap ?? "N/A"}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Current Boarders
                </div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {hostel.users?.length || 0}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Mess Subscribers
                </div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {subscribersCount}
                </div>
              </div>
            </div>

            {/* Info rows */}
            <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">Hostel Email</div>
                <a
                  href={`mailto:${hostel.microsoft_email}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {hostel.microsoft_email || "N/A"}
                </a>
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">Caterer</div>
                {!isEditingCaterer ? (
                  <div className="flex items-center gap-3">
                    <button
                      className="text-sm font-medium text-blue-600 hover:underline"
                      onClick={() => setIsEditingCaterer(true)}
                      title={
                        hostel.messId
                          ? "Click to change caterer"
                          : "Assign caterer"
                      }
                    >
                      {hostel.messId?.name || "Assign caterer"}
                    </button>
                    {hostel.messId?.name && (
                      <button
                        onClick={handleUnassignCaterer}
                        disabled={isUnassigning}
                        className="text-sm text-red-600 hover:underline disabled:text-gray-400"
                        title="Unassign current caterer"
                      >
                        {isUnassigning ? "Unassigning..." : "Unassign"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedMess}
                      onChange={(e) => setSelectedMess(e.target.value)}
                    >
                      <option value="">-- Choose a caterer --</option>
                      {unassignedMess.map((mess) => (
                        <option key={mess._id} value={mess._id}>
                          {mess.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={async () => {
                        await handleCatererChange();
                        setIsEditingCaterer(false);
                      }}
                      disabled={!selectedMess || isAssigning}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isAssigning ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingCaterer(false);
                        setSelectedMess("");
                      }}
                      className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "boarders" && (
          <HostelUsersList
            hostelName={hostel.hostel_name}
            users={hostel.users}
          />
        )}

        {activeTab === "subscribers" &&
          (loadingSubscribers ? (
            <div className="p-6 text-gray-600">Loading subscribers...</div>
          ) : (
            <MessSubscribersList
              hostelName={hostel.hostel_name}
              subscribers={subscribersData?.subscribers || []}
            />
          ))}

        {activeTab === "stats" && messDetails && (
          <HostelStats
            hostelId={hostelId}
            hostelName={hostel.hostel_name}
            messId={messDetails._id}
          />
        )}

        {activeTab === "mess_shutdowns" && (
          <MessShutdowns hostelId={hostelId} />
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 mb-4">
            {successMessage}
          </div>
        )}
        {error && <div className="text-red-500">{error}</div>}
      </div>
    </div>
  );
}
