import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Card, Tag, Alert, Space, Typography, Divider, Row, Col } from "antd";
import {
  InfoCircleOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { BACKEND_URL } from "../apis/server";
import SchedulePanel from "./SchedulePanel";

const { Text } = Typography;

export default function FeedbackControl() {
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [error, setError] = useState("");
  // protect UI state from stale responses when multiple fetches overlap.
  const settingsRequestSeq = useRef(0);
  const scheduleRequestSeq = useRef(0);

  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const fetchSettings = useCallback(async () => {
    // only latest request is allowed to commit state.
    const requestId = ++settingsRequestSeq.current;
    try {
      setSettingsLoading(true);
      setError("");
      const res = await fetch(`${BACKEND_URL}/feedback/settings`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`Failed to fetch settings (${res.status})`);
      const data = await res.json();
      if (requestId !== settingsRequestSeq.current) return;
      setSettings(data);
    } catch (err) {
      if (requestId !== settingsRequestSeq.current) return;
      setError(err.message);
      setSettings(null);
    } finally {
      if (requestId === settingsRequestSeq.current) {
        setSettingsLoading(false);
      }
    }
  }, [authHeaders]);

  const fetchScheduleInfo = useCallback(async () => {
    // same stale-response guard for schedule endpoint.
    const requestId = ++scheduleRequestSeq.current;
    try {
      setScheduleLoading(true);
      const response = await fetch(`${BACKEND_URL}/feedback/schedule`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (requestId !== scheduleRequestSeq.current) return;
      setScheduleInfo(data.data);
    } catch (err) {
      if (requestId !== scheduleRequestSeq.current) return;
      console.error("Error fetching schedule info:", err);
      setScheduleInfo(null);
    } finally {
      if (requestId === scheduleRequestSeq.current) {
        setScheduleLoading(false);
      }
    }
  }, [authHeaders]);

  useEffect(() => {
    if (token) {
      fetchSettings();
      fetchScheduleInfo();
    } else {
      setError("Not authenticated as HAB admin.");
    }
  }, [token, fetchSettings, fetchScheduleInfo]);

  return (
    <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
      {error && (
        <Col span={24}>
          <Alert type="error" message="Error" description={error} showIcon />
        </Col>
      )}

      {/* Feedback Settings Panel */}
      <Col xs={24} lg={12}>
        <Card
          title={
            <>
              <InfoCircleOutlined
                style={{ color: "#1890ff", marginRight: 8 }}
              />{" "}
              Feedback Control
            </>
          }
          style={{
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            height: "100%",
          }}
          loading={settingsLoading}
        >
          {settings ? (
            <Space direction="vertical" style={{ width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text strong>Status:</Text>
                {settings.isEnabled ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    Open
                  </Tag>
                ) : (
                  <Tag color="default" icon={<StopOutlined />}>
                    Closed
                  </Tag>
                )}
              </div>
              <Divider style={{ margin: "12px 0" }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text strong style={{ display: "block", marginBottom: 4 }}>
                  Current Window:
                </Text>
                <Tag color="blue">#{settings.currentWindowNumber || 1}</Tag>
              </div>
              <Divider style={{ margin: "12px 0" }} />
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    Enabled At:
                  </Text>
                  <Text type="secondary">
                    {settings.enabledAt
                      ? new Date(settings.enabledAt).toLocaleString("en-IN")
                      : "-"}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    Disabled At:
                  </Text>
                  <Text type="secondary">
                    {settings.disabledAt
                      ? new Date(settings.disabledAt).toLocaleString("en-IN")
                      : "-"}
                  </Text>
                </Col>
              </Row>
            </Space>
          ) : (
            <Text type="secondary">Unable to load settings</Text>
          )}
        </Card>
      </Col>

      {/* Automatic Schedule Panel */}
      <Col xs={24} lg={12}>
        <SchedulePanel scheduleInfo={scheduleInfo} loading={scheduleLoading} />
      </Col>
    </Row>
  );
}
