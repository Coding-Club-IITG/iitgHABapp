import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Tabs } from "antd";
import {
  ArrowLeft,
  QrCode,
  Download,
  AlertCircle,
  Star,
  Trophy,
  FileText,
} from "lucide-react";
import { getMessById, getMessMenuByDay } from "../apis/mess";
import { BACKEND_URL } from "../apis/server";
import FeedbackList from "./FeedbackList";

export default function MessDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [mess, setMess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMess() {
      if (!id) {
        setError("Invalid mess ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getMessById(id);
        setMess(data);
        setError(null);
      } catch (error) {
        console.error("Error fetching mess:", error);
        setError("Failed to load mess details. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchMess();
  }, [id]);

  // Deletion of mess is disabled in the UI per new requirement.

  const handleGoBack = () => {
    navigate("/caterers/");
  };

  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState(null);
  const [menuDay, setMenuDay] = useState("Monday");
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    let ignore = false;
    async function fetchMenu() {
      if (!id) return;
      setMenuLoading(true);
      setMenuError(null);
      try {
        const token =
          localStorage.getItem("admin_token") || localStorage.getItem("token");
        const data = await getMessMenuByDay(id, menuDay, token);
        if (!ignore) {
          setMenuItems(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!ignore) setMenuError("Failed to load menu.");
        console.error("Menu fetch error", e);
      } finally {
        if (!ignore) setMenuLoading(false);
      }
    }
    fetchMenu();
    return () => {
      ignore = true;
    };
  }, [id, menuDay]);

  const passedFeedbacks = Array.isArray(location.state?.feedbacks)
    ? location.state.feedbacks
    : null;
  // Simplified: no separate loading/error states for feedback fetch
  const [fbPage, setFbPage] = useState(1);
  const [fbPageSize] = useState(10);
  const [fbTotal, setFbTotal] = useState(0);
  const [fbItems, setFbItems] = useState([]);
  const [fbOpi, setFbOpi] = useState(null);
  const [fbRank, setFbRank] = useState(null);
  const [selectedWindow, setSelectedWindow] = useState("");

  const handleDownloadQrCode = async () => {
    if (!mess?.qr_img) return;

    const image = new Image();
    image.src = mess.qr_img;

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const exportSize = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = exportSize;
    canvas.height = exportSize;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, exportSize, exportSize);
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, exportSize, exportSize);

    const pngDataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngDataUrl;
    link.download = `QR_${mess?.name || "mess"}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  useEffect(() => {
    let ignore = false;
    async function fetchWindows() {
      try {
        const token =
          localStorage.getItem("admin_token") || localStorage.getItem("token");
        const res = await fetch(`${BACKEND_URL}/feedback/windows`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const text = await res.text();
        let data = [];
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("[MessDetails] windows JSON parse error", e);
        }
        if (!ignore && Array.isArray(data) && data.length > 0) {
          setSelectedWindow(data[0]);
        }
      } catch (e) {
        console.error("Failed to load windows", e);
      }
    }
    fetchWindows();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchFeedbacks() {
      if (!id) return;
      try {
        const token =
          localStorage.getItem("admin_token") || localStorage.getItem("token");
        const base = `${BACKEND_URL}/feedback/by-caterer?catererId=${id}&page=${fbPage}&pageSize=${fbPageSize}`;
        const url = selectedWindow
          ? `${base}&windowNumber=${selectedWindow}`
          : base;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const text = await res.text();
        if (!res.ok) {
          console.error("Failed to fetch feedbacks", res.status);
          return;
        }
        let data = {};
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("[MessDetails] feedbacks JSON parse error", e);
          return;
        }
        if (!ignore) {
          setFbItems(Array.isArray(data.items) ? data.items : []);
          setFbTotal(typeof data.total === "number" ? data.total : 0);
          setFbOpi(typeof data.opi === "number" ? data.opi : null);
          setFbRank(typeof data.rank === "number" ? data.rank : null);
        }
      } catch (e) {
        console.error("Feedback fetch failed", e);
      }
    }
    fetchFeedbacks();
    return () => {
      ignore = true;
    };
  }, [id, fbPage, fbPageSize, selectedWindow]);

  useEffect(() => {
    setFbPage(1);
  }, [selectedWindow]);

  const fallbackFeedbacks = passedFeedbacks
    ? passedFeedbacks
    : Array.isArray(mess?.complaints)
      ? mess.complaints
      : typeof mess?.complaints === "number"
        ? []
        : [];
  const feedbackList = fbItems.length > 0 ? fbItems : fallbackFeedbacks;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading mess details...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded border border-gray-300 p-8 max-w-md w-full">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="text-red-600" size={24} />
            <h2 className="text-lg font-semibold text-gray-900">Error</h2>
          </div>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleGoBack}
              className="flex-1 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!mess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded border border-gray-300 p-8 max-w-md w-full text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Mess Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            The requested mess could not be found.
          </p>
          <button
            onClick={handleGoBack}
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
          >
            Go Back to Caterers
          </button>
        </div>
      </div>
    );
  }

  const infoTab = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-300 rounded p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star size={18} className="text-gray-700" />
              <span className="text-sm font-medium text-gray-700">
                OPI Rating
              </span>
            </div>
            {selectedWindow && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-300">
                Window {selectedWindow}
              </span>
            )}
          </div>
          <div className="text-3xl font-semibold text-gray-900">
            {fbOpi != null ? fbOpi.toFixed(2) : mess?.rating || "N/A"}
            <span className="text-base text-gray-500 font-normal ml-2">
              / 5.0
            </span>
          </div>
        </div>
        <div className="bg-white border border-gray-300 rounded p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-gray-700" />
              <span className="text-sm font-medium text-gray-700">Rank</span>
            </div>
            {selectedWindow && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-300">
                Window {selectedWindow}
              </span>
            )}
          </div>
          <div className="text-3xl font-semibold text-gray-900">
            {fbRank != null ? fbRank : mess?.ranking || "N/A"}
          </div>
        </div>
        <div className="bg-white border border-gray-300 rounded p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-gray-700" />
            <span className="text-sm font-medium text-gray-700">Feedbacks</span>
          </div>
          <div className="text-3xl font-semibold text-gray-900">
            {fbItems.length > 0 ? fbTotal : feedbackList.length}
          </div>
        </div>
      </div>
      <div className="bg-white border border-gray-300 rounded">
        <div className="border-b border-gray-300 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <QrCode size={18} className="text-gray-700" /> QR Code
          </h3>
        </div>
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-start gap-8">
            <div className="flex-shrink-0">
              <div className="p-4 bg-white border border-gray-300 rounded w-48 h-48 flex items-center justify-center">
                <img
                  src={mess?.qr_img}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Access Information
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Scan this QR code to access caterer services, menu
                  information, and provide feedback. Share this code with
                  students and staff for easy access.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadQrCode}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded text-sm font-medium transition-colors"
              >
                <Download size={16} /> Download QR Code
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const menuTab = (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Day:</label>
          <select
            value={menuDay}
            onChange={(e) => setMenuDay(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            {[
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>
      {menuLoading && (
        <div className="text-sm text-gray-500">Loading menu...</div>
      )}
      {!menuLoading && menuError && (
        <div className="text-sm text-red-600">{menuError}</div>
      )}
      {!menuLoading && !menuError && menuItems.length === 0 && (
        <div className="text-sm text-gray-500">
          No menu items for {menuDay}.
        </div>
      )}
      {!menuLoading && !menuError && menuItems.length > 0 && (
        <div className="space-y-3">
          {menuItems.map((entry) => (
            <div
              key={entry._id || `${entry.day}-${entry.type}`}
              className="border border-gray-300 rounded p-4 bg-white"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-2xl text-gray-800">
                  {entry.type}
                </span>
              </div>
              {(() => {
                const raw = Array.isArray(entry.items) ? entry.items : [];
                const norm = raw.map((it) =>
                  typeof it === "object"
                    ? it
                    : { name: String(it), type: "Others", likes: [] },
                );
                const byType = (t) =>
                  norm.filter((i) => (i?.type || "Others") === t);
                const dish = byType("Dish");
                const breads = byType("Breads and Rice");
                const others = byType("Others");
                const ItemRow = ({ item }) => {
                  const name = item?.name;
                  if (!name) return null;
                  const likes = Array.isArray(item?.likes)
                    ? item.likes.length
                    : 0;
                  return (
                    <div className="flex items-center gap-2 rounded px-2 py-1 bg-gray-50 hover:bg-gray-100 transition text-sm">
                      {/* Bullet dot for visual scan */}
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block flex-shrink-0"></span>
                      <span className="text-gray-800 leading-none">{name}</span>
                      <span className="text-[10px] leading-none px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-600 font-medium shadow-sm">
                        {likes}
                      </span>
                    </div>
                  );
                };
                const Section = ({ title, items }) => (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold tracking-wide text-gray-500">
                      {title}
                    </div>
                    {items.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {items.map((i) => (
                          <ItemRow key={i?._id || i.name} item={i} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 font-medium">-</div>
                    )}
                  </div>
                );
                return (
                  <div className="space-y-5">
                    <Section title="DISH" items={dish} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Section title="BREADS & RICE" items={breads} />
                      <Section title="OTHERS" items={others} />
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const feedbackTab = (
    <FeedbackList
      feedbacks={feedbackList}
      pageSize={fbPageSize}
      page={fbItems.length > 0 ? fbPage : undefined}
      serverTotal={fbItems.length > 0 ? fbTotal : undefined}
      onPageChange={fbItems.length > 0 ? setFbPage : undefined}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded border border-gray-300 p-6 mb-6 flex items-center justify-between">
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="font-medium">Back</span>
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-900">
              {mess.name}
            </h1>
            <p className="text-gray-500 text-sm">Caterer Dashboard</p>
          </div>
          {/* Delete action removed intentionally */}
        </div>
        <Tabs
          defaultActiveKey="info"
          items={[
            { key: "info", label: "Caterer Info", children: infoTab },
            { key: "menu", label: "Menu", children: menuTab },
            { key: "feedbacks", label: "Feedbacks", children: feedbackTab },
          ]}
        />
      </div>
    </div>
  );
}
