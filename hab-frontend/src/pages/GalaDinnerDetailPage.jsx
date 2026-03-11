import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../apis/server";
import { Typography, Select, Card, Row, Col, Statistic, Spin, Button } from "antd";
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
    [token]
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
        setHostels(Array.isArray(data) ? data : []);
        if (data?.length > 0 && !selectedHostelId) {
          setSelectedHostelId(data[0]._id);
        }
      } catch (err) {
        console.error("Failed to fetch hostels:", err);
        setHostels([]);
      } finally {
        setHostelsLoading(false);
      }
    };
    fetchHostels();
  }, [token]);

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
          { headers: { ...authHeaders } }
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
  }, [galaDinnerId, selectedHostelId, token]);

  const hostelOptions = hostels.map((h) => ({
    value: h._id,
    label: h.hostel_name || h._id,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/gala-dinner")}
        >
          Back
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Title level={4} className="!mb-0">
          Gala Dinner Details
        </Title>
        <div className="flex items-center gap-2">
          <Text type="secondary">Hostel:</Text>
          <Select
            style={{ minWidth: 200 }}
            placeholder="Select hostel"
            value={selectedHostelId}
            onChange={setSelectedHostelId}
            options={hostelOptions}
            loading={hostelsLoading}
          />
        </div>
      </div>

      {detail?.galaDinner && (
        <Card>
          <div className="space-y-1">
            <div>
              <Text strong>Date: </Text>
              <Text>{dayjs(detail.galaDinner.date).format("DD MMM YYYY")}</Text>
            </div>
            {(detail.galaDinner.startersServingStartTime || detail.galaDinner.dinnerServingStartTime) && (
              <div>
                <Text strong>Serving times: </Text>
                <Text>
                  {detail.galaDinner.startersServingStartTime
                    ? `Starters at ${formatTimeDisplay(detail.galaDinner.startersServingStartTime)}`
                    : ""}
                  {detail.galaDinner.startersServingStartTime && detail.galaDinner.dinnerServingStartTime ? ", " : ""}
                  {detail.galaDinner.dinnerServingStartTime
                    ? `Dinner at ${formatTimeDisplay(detail.galaDinner.dinnerServingStartTime)}`
                    : ""}
                </Text>
              </div>
            )}
          </div>
        </Card>
      )}

      {detailLoading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : detail ? (
        <>
          <Card title="Scan counts (this hostel)">
            <Row gutter={24}>
              <Col span={8}>
                <Statistic
                  title="Starters"
                  value={detail.scanStats?.startersCount ?? 0}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Main Course"
                  value={detail.scanStats?.mainCourseCount ?? 0}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Desserts"
                  value={detail.scanStats?.dessertsCount ?? 0}
                />
              </Col>
            </Row>
          </Card>

          <Row gutter={[16, 16]}>
            {(detail.menus || []).map((menu) => (
              <Col xs={24} md={8} key={menu._id}>
                <Card title={menu.category} size="small">
                  <ul className="list-disc pl-4 space-y-1">
                    {(menu.items || []).map((item) => (
                      <li key={item._id}>
                        {item.name}
                        {item.type && (
                          <Text type="secondary" className="ml-1">
                            ({item.type})
                          </Text>
                        )}
                      </li>
                    ))}
                  </ul>
                  {(!menu.items || menu.items.length === 0) && (
                    <Text type="secondary">No items</Text>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </>
      ) : selectedHostelId && !detailLoading ? (
        <Card>
          <Text type="secondary">No detail found for this gala dinner.</Text>
        </Card>
      ) : null}
    </div>
  );
}
