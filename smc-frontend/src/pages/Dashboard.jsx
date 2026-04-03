import { useAuth } from "../context/AuthProvider";
import React, { useState, useEffect, useCallback } from "react";
import Menu_content from "../components/Menu_content.jsx";
import apiClient from "../apiClient";
import { API_BASE_URL } from "../apis";
import CreateMenuFallback from "../components/CreateMenuFallback.jsx";
import { Menu, Download, LogOut, Bell, Gift } from "lucide-react";
import NotificationSender from "../components/NotificationSender";
import GalaDinnerContent from "../components/GalaDinnerContent";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Tabs from "../components/ui/Tabs";

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState("menu");
  const { user, logout } = useAuth();

  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [menuExists, setMenuExists] = useState(true);
  const [currentMenu, setCurrentMenu] = useState({
    breakfast: [],
    lunch: [],
    dinner: [],
  });
  const [timings, setTimings] = useState({
    btime_s: "",
    ltime_s: "",
    dtime_s: "",
    btime_e: "",
    ltime_e: "",
    dtime_e: "",
  });

  const [activeTab, setActiveTab] = useState(() => {
    let initialDay = new Date().getDay();
    return initialDay === 0 ? 6 : initialDay - 1;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [messId, setMessId] = useState(null);

  // Get user's hostel and messId
  const getUserHostel = async () => {
    try {
      if (!user?.hostel) return null;
      const response = await apiClient.get(
        `/hostel/all/smc/${user.hostel}`,
      );
      return response.data.hostel;
    } catch (err) {
      console.error("Error fetching hostel:", err);
      return null;
    }
  };

  // Fetch hostel and messId on mount
  useEffect(() => {
    const fetchHostel = async () => {
      if (!user?.hostel) return;
      const hostel = await getUserHostel();
      if (hostel?.messId) {
        setMessId(hostel.messId._id || hostel.messId);
      }
    };
    fetchHostel();
  }, [user]);

  const fetchMess = useCallback(async () => {
    if (!messId || !user?.hostel) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.post(
        `/mess/menu/smc/${messId}`,
        { day: days[activeTab] },
      );

      if (response.data === "DoesntExist") {
        setMenuExists(false);
        setShowCreateMenu(false);
        setCurrentMenu({ breakfast: [], lunch: [], dinner: [] });
      } else {
        setMenuExists(true);
        setShowCreateMenu(false);

        const menuData = {
          breakfast: [],
          lunch: [],
          dinner: [],
          id: response.data._id,
        };

        const timeData = {
          btime_s: "",
          ltime_s: "",
          dtime_s: "",
          btime_e: "",
          ltime_e: "",
          dtime_e: "",
        };

        response.data.forEach((element) => {
          if (element.type === "Breakfast") {
            timeData.btime_s = element.startTime;
            timeData.btime_e = element.endTime;
            element.items.forEach((item) => {
              menuData.breakfast.push({
                id: item._id,
                name: item.name,
                category: item.type,
              });
            });
          } else if (element.type === "Lunch") {
            timeData.ltime_s = element.startTime;
            timeData.ltime_e = element.endTime;
            element.items.forEach((item) => {
              menuData.lunch.push({
                id: item._id,
                name: item.name,
                category: item.type,
              });
            });
          } else if (element.type === "Dinner") {
            timeData.dtime_s = element.startTime;
            timeData.dtime_e = element.endTime;
            element.items.forEach((item) => {
              menuData.dinner.push({
                id: item._id,
                name: item.name,
                category: item.type,
              });
            });
          }
        });

        setCurrentMenu(menuData);
        setTimings(timeData);
      }
    } catch (error) {
      console.error("Error fetching menu:", error);
      setShowCreateMenu(true);
      setCurrentMenu({ breakfast: [], lunch: [], dinner: [] });
    } finally {
      setIsLoading(false);
    }
  }, [messId, activeTab]);

  useEffect(() => {
    fetchMess();
  }, [fetchMess]);

  const handleSuccessfulMenuCreation = () => {
    setShowCreateMenu(false);
    fetchMess();
  };

  const handleSuccessfulMenuItemCreation = () => {
    fetchMess();
  };

  const handleGoToCreateMenu = () => {
    setShowCreateMenu(true);
  };

  const downloadMenu = async () => {
    if (!messId) {
      alert("Mess ID not available");
      return;
    }

    try {
      const response = await apiClient.get("/mess/menu/download", {
        params: { day: days[activeTab], messId: messId },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/octet-stream",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const disposition = response.headers["content-disposition"];
      let filename = `menu-${days[activeTab]}.pdf`;
      if (disposition) {
        const match = disposition.match(/filename=?"?([^";]+)"?/);
        if (match) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download menu:", error);
      alert(error.response?.data?.message || "Failed to download menu");
    }
  };

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
                  <Menu className="w-5 h-5 text-gray-700" />
                </button>
                {sidebarOpen && (
                  <div>
                    <h2 className="text-lg font-semibold">SMC Portal</h2>
                    <p className="text-xs text-gray-500">Menu Management</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setCurrentPage("menu")}
                className={`flex items-center ${
                  sidebarOpen ? "gap-3 px-3 mx-1" : "justify-center px-0 mx-0"
                } w-full py-2 rounded-md ${
                  currentPage === "menu"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Menu className="w-5 h-5" />
                {sidebarOpen && <span>Menu Management</span>}
              </button>
              <button
                onClick={() => setCurrentPage("gala")}
                className={`flex items-center ${
                  sidebarOpen ? "gap-3 px-3 mx-1" : "justify-center px-0 mx-0"
                } w-full py-2 rounded-md ${
                  currentPage === "gala"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Gift className="w-5 h-5" />
                {sidebarOpen && <span>Gala Dinner</span>}
              </button>
              <button
                onClick={() => setCurrentPage("notifications")}
                className={`flex items-center ${
                  sidebarOpen ? "gap-3 px-3 mx-1" : "justify-center px-0 mx-0"
                } w-full py-2 rounded-md ${
                  currentPage === "notifications"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Bell className="w-5 h-5" />
                {sidebarOpen && <span>Notifications</span>}
              </button>
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
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
                {sidebarOpen && <span>Logout</span>}
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 w-full">
            {currentPage === "notifications" ? (
              <NotificationSender />
            ) : currentPage === "gala" ? (
              <GalaDinnerContent />
            ) : (
              <>
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold">Menu Management</h1>
                      <p className="text-sm text-gray-500">
                        {days[activeTab]} overview
                      </p>
                    </div>
                    <Button onClick={downloadMenu}>
                      <Download className="w-4 h-4 mr-2" /> Download
                    </Button>
                  </div>
                </Card>

                <div className="mt-6">
                  <div className="bg-white border-b border-gray-200 overflow-x-auto rounded-md w-full">
                    <div className="flex justify-between items-center px-4 py-3">
                      <Tabs
                        items={days.map((d, i) => ({ label: d, value: i }))}
                        value={activeTab}
                        onChange={(val) => setActiveTab(val)}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    {showCreateMenu ? (
                      <div className="p-6 bg-white rounded-md">
                        <CreateMenuFallback
                          onSuccessfulCreation={handleSuccessfulMenuCreation}
                          activeDay={days[activeTab]}
                          messId={messId}
                        />
                      </div>
                    ) : isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        <span className="ml-3 text-gray-600 text-lg">
                          Loading menu...
                        </span>
                      </div>
                    ) : messId ? (
                      <div className="w-full">
                        <Menu_content
                          key={activeTab}
                          day={days[activeTab]}
                          breakfast={currentMenu.breakfast}
                          lunch={currentMenu.lunch}
                          dinner={currentMenu.dinner}
                          messId={messId}
                          timeData={timings}
                          onSuccessfulItemCreation={
                            handleSuccessfulMenuItemCreation
                          }
                          click={handleGoToCreateMenu}
                          menuExists={menuExists}
                        />
                      </div>
                    ) : (
                      <div className="p-6 bg-white rounded-md text-center text-gray-500">
                        Hostel or Mess information not available
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
