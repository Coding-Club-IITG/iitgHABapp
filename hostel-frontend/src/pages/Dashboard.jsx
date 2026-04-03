import React, { useState } from "react";
import { useAuth } from "../context/AuthProvider";
import {
  Users,
  FileText,
  UserCheck,
  Building2,
  LogOut,
  Shirt,
  Receipt,
} from "lucide-react";
import MessBillCalculator from "../components/MessBillCalculator";

import BoardersTab from "../components/dashboard/BoardersTab";
import SubscribersTab from "../components/dashboard/SubscribersTab";
import SMCTab from "../components/dashboard/SMCTab";
import CleanersTab from "../components/dashboard/CleanersTab";
import LaundryTab from "../components/dashboard/LaundryTab";
import MessWorkersTab from "../components/dashboard/MessWorkersTab";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("boarders");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const tabItems = [
    { label: "Boarders", value: "boarders", icon: Users },
    { label: "Mess Subscribers", value: "subscribers", icon: Building2 },
    { label: "SMC Management", value: "smc", icon: UserCheck },
    { label: "Room Cleaners", value: "cleaners", icon: Users },
    { label: "Laundry", value: "laundry", icon: Shirt },
    { label: "Bill", value: "bill", icon: Receipt },
    { label: "Mess Workers", value: "mess_workers", icon: FileText },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "boarders":
        return <BoardersTab />;
      case "subscribers":
        return <SubscribersTab user={user} />;
      case "smc":
        return <SMCTab />;
      case "cleaners":
        return <CleanersTab />;
      case "laundry":
        return <LaundryTab />;
      case "mess_workers":
        return <MessWorkersTab />;
      case "bill":
        return (
          <MessBillCalculator
            hostelId={user?._id}
            hostelName={user?.hostel_name}
          />
        );
      default:
        return null;
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
            className={`bg-white border border-gray-100 rounded-lg shadow-sm p-3 transition-all duration-200 flex flex-col overflow-x-hidden overflow-y-auto ${
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
                  className="p-2 rounded-md hover:bg-gray-100 shrink-0"
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
                  <div className="overflow-hidden">
                    <h2 className="text-lg font-semibold truncate">
                      {user?.hostel_name || "Hostel"}
                    </h2>
                    <p className="text-xs text-gray-500">Hostel Office</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 flex-grow overflow-y-auto">
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
                    } w-full py-2 rounded-md transition-colors ${
                      activeTab === tab.value
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {sidebarOpen && <span className="truncate">{tab.label}</span>}
                  </button>
                );
              })}
            </div>
            <div
              className={`mt-4 pt-4 border-t border-gray-100 ${
                sidebarOpen ? "px-2" : "flex justify-center"
              }`}
            >
              <button
                onClick={() => logout()}
                className={
                  sidebarOpen
                    ? "w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-100 rounded-md py-2 text-sm transition-colors"
                    : "w-10 h-10 flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors shrink-0"
                }
                title="Logout"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>Logout</span>}
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 w-full min-w-0">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
