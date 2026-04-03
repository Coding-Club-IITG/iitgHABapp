// Simplified Tailwind-based sidebar aligned with SMC layout
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import {
  HomeOutlined,
  BankOutlined,
  ShopOutlined,
  UserOutlined,
  UploadOutlined,
  BarChartOutlined,
  SettingOutlined,
  BookOutlined,
  NotificationOutlined,
  GiftOutlined,
} from "@ant-design/icons";

const Sidebar = ({ collapsed = false, onToggle }) => {
  const { logout } = useAuth();

  const navItems = [
    { key: "1", name: "Home", path: "/", icon: <HomeOutlined /> },
    { key: "2", name: "Hostels", path: "/hostels", icon: <BankOutlined /> },
    { key: "3", name: "Caterers", path: "/caterers", icon: <ShopOutlined /> },
    { key: "4", name: "Students", path: "/students", icon: <UserOutlined /> },
    {
      key: "5",
      name: "Mess Change",
      path: "/mess/changeapplication",
      icon: <BarChartOutlined />,
    },
    {
      key: "6",
      name: "Gala Dinner",
      path: "/gala-dinner",
      icon: <GiftOutlined />,
    },
    {
      key: "7",
      name: "Send Notifications",
      path: "/notifications",
      icon: <NotificationOutlined />,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div
        className={`px-3 py-4 border-b border-gray-100 flex items-center ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <button
          onClick={onToggle}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-700"
          title={collapsed ? "Expand" : "Collapse"}
        >
          <span className="sr-only">Toggle sidebar</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {!collapsed && (
          <div className="text-center flex-1">
            <div className="text-xl font-bold leading-tight">IIT Guwahati</div>
            <div className="text-sm text-gray-500">Hostel Affairs Board</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            end
            className={({ isActive }) =>
              `flex items-center ${
                collapsed ? "justify-center px-0" : "gap-3 px-3"
              } w-full py-2 rounded-md ${collapsed ? "mx-0" : "mx-1"} text-sm ${
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {!collapsed && <span>{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      <div
        className={`mt-auto ${
          collapsed
            ? "flex justify-center py-4 border-t border-gray-100"
            : "px-3 py-3 border-t border-gray-100"
        }`}
      >
        <button
          onClick={logout}
          className={`${
            collapsed
              ? "w-10 h-10 flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
              : "w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-100 rounded-md py-2 text-sm transition-colors"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={collapsed ? "w-5 h-5" : "w-5 h-5"}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H3"
            />
          </svg>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
      {!collapsed && (
        <div className="px-3 pb-4 text-center text-xs text-gray-500">
          <div>Coding Club</div>
          <div className="mt-1">© 2025 IIT Guwahati</div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
