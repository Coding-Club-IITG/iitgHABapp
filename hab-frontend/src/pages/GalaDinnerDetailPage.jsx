import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../apis/server";
import {
  Typography,
  Select,
  Card,
  Row,
  Col,
  Statistic,
  Spin,
  Button,
  Space,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;

function formatTimeDisplay(str) {
  if (!str || typeof str !== "string") return "—";
  const match = str.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return str;
  const h = parseInt(match[1], 10);
  const m = match[2];
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${h12}:${m} ${ampm}`;
}

export default function GalaDinnerDetailPage() {
  const { galaDinnerId } = useParams();
  const navigate = useNavigate();
  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const [hostels, setHostels] = useState([]);
  const [hostelsLoading, setHostelsLoading] = useState(true);
  const [selectedHostelId, setSelectedHostelId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const fetchHostels = async () => {
      try {
        setHostelsLoading(true);
        const response = await fetch(`${BACKEND_URL}/hostel/allhostel`, {
          headers: { ...authHeaders },
        });
        if (!response.ok) throw new Error("Fetch failed");
        const data = await response.json();
        const list = Array.isArray(data)
          ? data
          : data?.hostels || data?.data || [];
        setHostels(list);
        if (list?.length > 0 && !selectedHostelId) {
          setSelectedHostelId(list[0]._id);
        }
      } catch (err) {
        console.error("Failed to fetch hostels:", err);
        setHostels([]);
      } finally {
        setHostelsLoading(false);
      }
    };
    fetchHostels();
  }, [authHeaders, selectedHostelId]);

  useEffect(() => {
    if (!galaDinnerId || !selectedHostelId) {
      setDetail(null);
      return;
    }
    const fetchDetail = async () => {
      try {
        setDetailLoading(true);
        const response = await fetch(
          `${BACKEND_URL}/gala/${galaDinnerId}/detail?hostelId=${selectedHostelId}`,
          { headers: { ...authHeaders } },
        );
        if (!response.ok) throw new Error("Fetch failed");
        const data = await response.json();
        setDetail(data);
      } catch (err) {
        console.error("Failed to fetch detail:", err);
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [galaDinnerId, selectedHostelId, authHeaders]);

  const hostelOptions = hostels.map((h) => ({
    value: h._id,
    label: h.hostel_name || h._id,
  }));

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
            onClick={() => navigate("/gala-dinner")}
            type="text"
          >
            Back
          </Button>
          <div style={{ textAlign: "center", flex: 1 }}>
            <Title level={2} style={{ margin: 0 }}>
              Gala Dinner Details
            </Title>
            <Text type="secondary">
              View scan counts and menus for specific hostels
            </Text>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Text type="secondary" strong>
              Hostel:
            </Text>
            <Select
              style={{ minWidth: 200 }}
              placeholder="Select hostel"
              value={selectedHostelId}
              onChange={setSelectedHostelId}
              options={hostelOptions}
              loading={hostelsLoading}
              size="large"
            />
          </div>
        </div>

        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {detail?.galaDinner && (
            <Card
              style={{
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              <Row gutter={[24, 24]} align="middle">
                <Col>
                  <Text strong style={{ fontSize: 16 }}>
                    Date:{" "}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    {dayjs(detail.galaDinner.date).format("DD MMM YYYY")}
                  </Text>
                </Col>
                {(detail.galaDinner.startersServingStartTime ||
                  detail.galaDinner.dinnerServingStartTime) && (
                  <Col>
                    <Text strong style={{ fontSize: 16 }}>
                      Serving times:{" "}
                    </Text>
                    <Text style={{ fontSize: 16 }}>
                      {detail.galaDinner.startersServingStartTime
                        ? `Starters at ${formatTimeDisplay(detail.galaDinner.startersServingStartTime)}`
                        : ""}
                      {detail.galaDinner.startersServingStartTime &&
                      detail.galaDinner.dinnerServingStartTime
                        ? " | "
                        : ""}
                      {detail.galaDinner.dinnerServingStartTime
                        ? `Dinner at ${formatTimeDisplay(detail.galaDinner.dinnerServingStartTime)}`
                        : ""}
                    </Text>
                  </Col>
                )}
              </Row>
            </Card>
          )}

          {detailLoading ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <Spin size="large" tip="Loading details..." />
            </div>
          ) : detail ? (
            <>
              <Card
                title={
                  <Title level={4} style={{ margin: 0 }}>
                    Scan counts
                  </Title>
                }
                style={{
                  borderRadius: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                <Row gutter={[24, 24]}>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Starters"
                      value={detail.scanStats?.startersCount ?? 0}
                      valueStyle={{ color: "#1890ff", fontWeight: "bold" }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Main Course"
                      value={detail.scanStats?.mainCourseCount ?? 0}
                      valueStyle={{ color: "#52c41a", fontWeight: "bold" }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Desserts"
                      value={detail.scanStats?.dessertsCount ?? 0}
                      valueStyle={{ color: "#722ed1", fontWeight: "bold" }}
                    />
                  </Col>
                </Row>
              </Card>

              <Row gutter={[24, 24]}>
                {(detail.menus || []).map((menu) => (
                  <Col xs={24} md={8} key={menu._id}>
                    <Card
                      title={menu.category}
                      style={{
                        borderRadius: 8,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                        height: "100%",
                      }}
                    >
                      <ul
                        style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8 }}
                      >
                        {(menu.items || []).map((item) => (
                          <li key={item._id}>
                            <Text>{item.name}</Text>
                            {item.type && (
                              <Text
                                type="secondary"
                                style={{ marginLeft: 6, fontSize: 12 }}
                              >
                                ({item.type})
                              </Text>
                            )}
                          </li>
                        ))}
                      </ul>
                      {(!menu.items || menu.items.length === 0) && (
                        <Text type="secondary">
                          No items added to this menu yet.
                        </Text>
                      )}
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          ) : selectedHostelId && !detailLoading ? (
            <Card
              style={{
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                textAlign: "center",
              }}
            >
              <Text type="secondary">
                No detail found for this gala dinner.
              </Text>
            </Card>
          ) : null}
        </Space>
      </div>
    </div>
  );
}
