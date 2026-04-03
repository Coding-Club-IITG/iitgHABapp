import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import Home from "./pages/Home";
import AllHostelList from "./pages/AllHostelList";
import Caterers from "./pages/Caterers";
import Students from "./pages/Students";
import HostelForm from "./pages/HostelForm";
import HostelPage from "./pages/HostelPage";
import MessChangePage from "./pages/MessChangePage.jsx";
import GalaDinnerPage from "./pages/GalaDinnerPage.jsx";
import GalaDinnerDetailPage from "./pages/GalaDinnerDetailPage.jsx";
import Notifications from "./pages/Notifications.jsx";
import CreateMess from "./components/CreateMess";
import MessDetails from "./components/MessDetails";
import MessMenu from "./components/MessMenu";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";

function App() {
  const BASENAME =
    import.meta.env.VITE_BASE ||
    (window.location.pathname.startsWith("/hab") ? "/hab" : "/");

  // Local wrapper to manage collapsible sidebar state
  const HabSidebarWrapper = () => {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <div
        style={{
          height: "calc(100vh - 48px)",
          position: "sticky",
          top: "24px",
        }}
        className={`bg-white border border-gray-100 rounded-lg shadow-sm p-3 flex flex-col transition-all duration-200 ${
          collapsed ? "w-16" : "w-72"
        }`}
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>
    );
  };

  return (
    <Router basename={BASENAME}>
      <AuthProvider>
        <Routes>
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 w-full">
                  <div className="w-full p-6">
                    <div className="flex gap-6 w-full">
                      {/* Collapsible Sidebar */}
                      <HabSidebarWrapper />
                      {/* Main content area */}
                      <div className="flex-1 w-full">
                        <Routes>
                          <Route path="/" element={<Home />} />
                          <Route path="/hostels" element={<AllHostelList />} />
                          <Route
                            path="/create-hostel"
                            element={<HostelForm />}
                          />
                          <Route
                            path="/hostel/:hostelId"
                            element={<HostelPage />}
                          />
                          <Route path="/caterers" element={<Caterers />} />
                          <Route path="/students" element={<Students />} />
                          <Route path="/create-mess" element={<CreateMess />} />
                          <Route path="/mess/:id" element={<MessDetails />} />
                          <Route path="/mess/menu/:id" element={<MessMenu />} />
                          <Route
                            path="/mess/changeapplication"
                            element={<MessChangePage />}
                          />
                          <Route
                            path="/gala-dinner"
                            element={<GalaDinnerPage />}
                          />
                          <Route
                            path="/gala-dinner/:galaDinnerId"
                            element={<GalaDinnerDetailPage />}
                          />
                          {/** Allocate Hostel and Profile Settings moved into Students page; routes removed */}
                          {/* Feedback Control page removed from router (now embedded in Caterers when needed) */}
                          {/** Feedback Leaderboard merged into Caterers; route removed */}
                          <Route
                            path="/notifications"
                            element={<Notifications />}
                          />
                        </Routes>
                      </div>
                    </div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
