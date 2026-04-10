import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Tabs,
  Typography,
  Card,
  Row,
  Col,
  Button,
  Spin,
  Alert,
  Select,
  Space,
  Tag,
} from "antd";
import {
  ArrowLeftOutlined,
  QrcodeOutlined,
  DownloadOutlined,
  StarOutlined,
  TrophyOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { getMessById, getMessMenuByDay } from "../apis/mess";
import { BACKEND_URL } from "../apis/server";
import FeedbackList from "./FeedbackList";

const { Title, Text } = Typography;

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

  const [fbPage, setFbPage] = useState(1);
  const [fbPageSize] = useState(10);
  const [fbTotal, setFbTotal] = useState(0);
  const [fbItems, setFbItems] = useState([]);
  const [fbOpi, setFbOpi] = useState(null);
  const [fbRank, setFbRank] = useState(null);
  const [selectedWindow, setSelectedWindow] = useState("");
  const [showOnlySMC, setShowOnlySMC] = useState(false);
  const [hideEmptyMessages, setHideEmptyMessages] = useState(false);
  const [hideRatings, setHideRatings] = useState(false);

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
        const base = `${BACKEND_URL}/feedback/by-caterer?catererId=${id}&page=${fbPage}&pageSize=${fbPageSize}&showOnlySMC=${showOnlySMC}&hideEmptyMessages=${hideEmptyMessages}`;
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
  }, [id, fbPage, fbPageSize, selectedWindow, showOnlySMC, hideEmptyMessages]);

  useEffect(() => {
    setFbPage(1);
  }, [selectedWindow, showOnlySMC, hideEmptyMessages]);

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
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" tip="Loading mess details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card
          style={{
            maxWidth: 500,
            width: "100%",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Button onClick={() => window.location.reload()} type="primary">
              Try Again
            </Button>
            <Button onClick={handleGoBack}>Go Back</Button>
          </Space>
        </Card>
      </div>
    );
  }

  if (!mess) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card
          style={{
            maxWidth: 500,
            width: "100%",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}
        >
          <Title level={4}>Mess Not Found</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
            The requested mess could not be found.
          </Text>
          <Button onClick={handleGoBack} type="primary">
            Go Back to Caterers
          </Button>
        </Card>
      </div>
    );
  }

  const infoTab = (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card
            style={{ borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Space>
                <StarOutlined style={{ color: "#faad14", fontSize: 18 }} />
                <Text strong>OPI Rating</Text>
              </Space>
              {selectedWindow && <Tag>Window {selectedWindow}</Tag>}
            </div>
            <div style={{ fontSize: 32, fontWeight: 600 }}>
              {fbOpi != null ? fbOpi.toFixed(2) : mess?.rating || "N/A"}
              <Text
                type="secondary"
                style={{ fontSize: 16, marginLeft: 8, fontWeight: 400 }}
              >
                / 5.0
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={{ borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Space>
                <TrophyOutlined style={{ color: "#1890ff", fontSize: 18 }} />
                <Text strong>Rank</Text>
              </Space>
              {selectedWindow && <Tag>Window {selectedWindow}</Tag>}
            </div>
            <div style={{ fontSize: 32, fontWeight: 600 }}>
              {fbRank != null ? fbRank : mess?.ranking || "N/A"}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={{ borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Space>
                <FileTextOutlined style={{ color: "#722ed1", fontSize: 18 }} />
                <Text strong>Feedbacks</Text>
              </Space>
            </div>
            <div style={{ fontSize: 32, fontWeight: 600 }}>
              {fbItems.length > 0 ? fbTotal : feedbackList.length}
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <>
            <QrcodeOutlined style={{ marginRight: 8 }} /> QR Code
          </>
        }
        style={{ borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
      >
        <Row gutter={[32, 32]} align="middle">
          <Col>
            <div
              style={{
                padding: 16,
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                display: "inline-block",
              }}
            >
              <img
                src={mess?.qr_img}
                alt="QR Code"
                style={{ width: 150, height: 150, objectFit: "contain" }}
              />
            </div>
          </Col>
          <Col flex="auto">
            <Title level={5}>Access Information</Title>
            <Text
              type="secondary"
              style={{ display: "block", marginBottom: 16, maxWidth: 500 }}
            >
              Scan this QR code to access caterer services, menu information,
              and provide feedback. Share this code with students and staff for
              easy access.
            </Text>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadQrCode}
            >
              Download QR Code
            </Button>
          </Col>
        </Row>
      </Card>
    </Space>
  );

  const menuTab = (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <Space>
          <Text>Day:</Text>
          <Select
            value={menuDay}
            onChange={(val) => setMenuDay(val)}
            style={{ width: 150 }}
            options={[
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].map((d) => ({ label: d, value: d }))}
          />
        </Space>
      </div>

      {menuLoading && (
        <Spin style={{ display: "block", margin: "40px auto" }} />
      )}
      {!menuLoading && menuError && <Alert type="error" message={menuError} />}
      {!menuLoading && !menuError && menuItems.length === 0 && (
        <Alert type="info" message={`No menu items for ${menuDay}.`} />
      )}

      {!menuLoading && !menuError && menuItems.length > 0 && (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {menuItems.map((entry) => (
            <Card
              key={entry._id || `${entry.day}-${entry.type}`}
              title={
                <Title level={4} style={{ margin: 0 }}>
                  {entry.type}
                </Title>
              }
              style={{
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
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
                    <Tag
                      style={{
                        padding: "4px 8px",
                        fontSize: 14,
                        margin: "4px 8px 4px 0",
                      }}
                    >
                      {name}{" "}
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, marginLeft: 4 }}
                      >
                        ({likes})
                      </Text>
                    </Tag>
                  );
                };

                const Section = ({ title, items }) => (
                  <div style={{ marginBottom: 16 }}>
                    <Text
                      type="secondary"
                      strong
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 12,
                        textTransform: "uppercase",
                      }}
                    >
                      {title}
                    </Text>
                    {items.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap" }}>
                        {items.map((i) => (
                          <ItemRow key={i?._id || i.name} item={i} />
                        ))}
                      </div>
                    ) : (
                      <Text type="secondary">-</Text>
                    )}
                  </div>
                );

                return (
                  <div>
                    <Section title="DISH" items={dish} />
                    <Row gutter={24}>
                      <Col span={12}>
                        <Section title="BREADS & RICE" items={breads} />
                      </Col>
                      <Col span={12}>
                        <Section title="OTHERS" items={others} />
                      </Col>
                    </Row>
                  </div>
                );
              })()}
            </Card>
          ))}
        </Space>
      )}
    </Space>
  );

  const feedbackTab = (
    <FeedbackList
      feedbacks={feedbackList}
      pageSize={fbPageSize}
      page={fbItems.length > 0 ? fbPage : undefined}
      serverTotal={fbItems.length > 0 ? fbTotal : undefined}
      onPageChange={fbItems.length > 0 ? setFbPage : undefined}
      showOnlySMC={showOnlySMC}
      onOnlySMCChange={setShowOnlySMC}
      hideEmptyMessages={hideEmptyMessages}
      onHideEmptyMessagesChange={setHideEmptyMessages}
      hideRatings={hideRatings}
      onHideRatingsChange={setHideRatings}
    />
  );

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "#f5f5f5",
        minHeight: "100vh",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fff",
            padding: "16px 24px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleGoBack}
            type="text"
          >
            Back
          </Button>
          <div style={{ textAlign: "center", flex: 1 }}>
            <Title level={2} style={{ margin: 0 }}>
              {mess.name}
            </Title>
            <Text type="secondary">Caterer Dashboard</Text>
          </div>
          <div style={{ width: 70 }} /> {/* Spacer for centering */}
        </div>

        <Card
          style={{ borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
          bodyStyle={{ padding: "0 24px 24px" }}
        >
          <Tabs
            defaultActiveKey="info"
            items={[
              {
                key: "info",
                label: "Caterer Info",
                children: <div style={{ paddingTop: 16 }}>{infoTab}</div>,
              },
              {
                key: "menu",
                label: "Menu",
                children: <div style={{ paddingTop: 16 }}>{menuTab}</div>,
              },
              {
                key: "feedbacks",
                label: "Feedbacks",
                children: <div style={{ paddingTop: 16 }}>{feedbackTab}</div>,
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
