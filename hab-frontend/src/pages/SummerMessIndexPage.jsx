import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Row, Space, Tag, Typography, message } from "antd";

import { getSummerMessSettings } from "../apis/summerMess";

const { Title, Paragraph, Text } = Typography;

function formatSeasonLabel(season) {
  return season?.seasonLabel || season?.seasonKey || "Unnamed season";
}

function formatWindow(startAt, endAt) {
  if (!startAt && !endAt) return "No dates set";
  const start = startAt ? new Date(startAt).toLocaleDateString() : "?";
  const end = endAt ? new Date(endAt).toLocaleDateString() : "?";
  return `${start} to ${end}`;
}

function formatSeasonTags(season) {
  const tags = [];
  if (season?.registration?.isOpen) tags.push("Registration Open");
  if (season?.summer?.isActive) tags.push("Summer Active");
  if (!season?.registration?.isOpen && !season?.summer?.isActive) {
    tags.push("Idle");
  }
  return tags;
}

function normalizeSeasonList(response) {
  const seasons = Array.isArray(response?.seasons) ? response.seasons : [];
  if (seasons.length > 0) return seasons;

  const fallbackSeason = response?.settings || response?.meta?.activeSeason || response?.meta?.openRegistrationSeason;
  return fallbackSeason ? [fallbackSeason] : [];
}

export default function SummerMessIndexPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState({ seasons: [], meta: null });

  const loadSeasons = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getSummerMessSettings();
      setPayload({
        seasons: normalizeSeasonList(response),
        meta: response?.meta || null,
      });
    } catch (nextError) {
      const nextMessage =
        nextError?.response?.data?.message ||
        nextError?.message ||
        "Failed to load summer mess seasons";
      setError(nextMessage);
      message.error(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeasons();
  }, []);

  const seasons = useMemo(() => payload.seasons || [], [payload.seasons]);

  return (
    <div style={{ padding: 24, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            Summer Mess
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 760 }}>
            Pick a summer season to open its settings page. This list shows the
            available summer mess seasons, their current status, and the date
            windows they are configured for.
          </Paragraph>
        </div>
        <Space wrap>
          <Button type="primary" onClick={() => navigate("/summer-mess/new")}>+ New Season</Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadSeasons}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {error ? (
        <Alert
          type="error"
          showIcon
          message="Could not load summer seasons"
          description={error}
          style={{ marginBottom: 24 }}
        />
      ) : null}

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}>
          <Card loading={loading}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Total seasons</Text>
              <Text strong style={{ fontSize: 28 }}>
                {seasons.length}
              </Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={loading}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Active summer</Text>
              <Text strong style={{ fontSize: 20 }}>
                {payload.meta?.activeSeason?.seasonLabel || "None"}
              </Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={loading}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Open registration</Text>
              <Text strong style={{ fontSize: 20 }}>
                {payload.meta?.openRegistrationSeason?.seasonLabel || "None"}
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="Available summer mess seasons" loading={loading}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {seasons.length ? (
            seasons.map((season) => {
              const tags = formatSeasonTags(season);
              return (
                <Card
                  key={season._id}
                  hoverable
                  onClick={() => navigate(`/summer-mess/${season._id}`)}
                  style={{ cursor: "pointer" }}
                  bodyStyle={{ padding: 20 }}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Title level={4} style={{ margin: 0 }}>
                          {formatSeasonLabel(season)}
                        </Title>
                        {tags.map((tag) => (
                          <Tag key={tag} color={tag === "Summer Active" ? "orange" : tag === "Registration Open" ? "green" : "default"}>
                            {tag}
                          </Tag>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-5 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-2">
                          <ClockCircleOutlined />
                          Registration: {formatWindow(season?.registration?.startAt, season?.registration?.endAt)}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <CheckCircleOutlined />
                          Summer: {formatWindow(season?.summer?.startAt, season?.summer?.endAt)}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <TeamOutlined />
                          {season?.participatingHostelCount || 0} participating hostels
                        </span>
                      </div>
                    </div>
                    <Button type="primary" icon={<ArrowRightOutlined />}>
                      Open
                    </Button>
                  </div>
                </Card>
              );
            })
          ) : (
            <Alert
              type="info"
              showIcon
              message="No summer seasons yet"
              description="Create a new season from the detail page when you are ready to set up the next summer mess cycle."
            />
          )}
        </Space>
      </Card>
    </div>
  );
}