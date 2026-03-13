import { useEffect, useState, useCallback, useRef } from "react";
import {
  Card,
  Button,
  Tag,
  Alert,
  Space,
  Typography,
  Divider,
  Spin,
} from "antd";
import { BACKEND_URL } from "../apis/server";

const { Text } = Typography;

export default function FeedbackControl() {
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const requestSeqRef = useRef(0);

  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");

  const fetchSettings = useCallback(async () => {
    const requestId = ++requestSeqRef.current;
    try {
      setSettingsLoading(true);
      setError("");
      const res = await fetch(`${BACKEND_URL}/feedback/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch settings (${res.status})`);
      const data = await res.json();
      if (requestId !== requestSeqRef.current) return;
      setSettings(data);
    } catch (err) {
      if (requestId !== requestSeqRef.current) return;
      setError(err.message);
      setSettings(null);
    } finally {
      if (requestId === requestSeqRef.current) {
        setSettingsLoading(false);
      }
    }
  }, [token]);

  async function updateState(endpoint, successMsg) {
    if (actionLoading) return;

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const res = await fetch(`${BACKEND_URL}/feedback/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok)
        throw new Error(`${endpoint.toUpperCase()} failed (${res.status})`);

      setSuccess(successMsg);
      await fetchSettings();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    token ? fetchSettings() : setError("Not authenticated as HAB admin.");
  }, [token, fetchSettings]);

  return (
    <Card
      title="Feedback Control"
      style={{
        marginTop: 32,
        borderRadius: 8,
        border: "1px solid #e5e7eb",
      }}
      headStyle={{ fontSize: 18, fontWeight: 600 }}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        {/* Alerts */}
        {error && (
          <Alert
            type="error"
            message="Error"
            description={error}
            showIcon={false}
            style={{ borderRadius: 6 }}
          />
        )}

        {success && (
          <Alert
            type="success"
            message="Success"
            description={success}
            showIcon={false}
            style={{ borderRadius: 6 }}
          />
        )}

        <Card
          bordered
          style={{
            background: "#fafafa",
            borderColor: "#e5e7eb",
            borderRadius: 6,
          }}
        >
          {settingsLoading ? (
            <Spin tip="Loading settings..." />
          ) : settings ? (
            <>
              {/* Status Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  rowGap: 12,
                  columnGap: 32,
                  fontSize: 14,
                }}
              >
                <div>
                  <Text strong>Status:</Text>
                  <span style={{ marginLeft: 8 }}>
                    <Tag
                      color={settings.isEnabled ? "blue" : "default"}
                      style={{ borderRadius: 4 }}
                    >
                      {settings.isEnabled ? "Open" : "Closed"}
                    </Tag>
                  </span>
                </div>

                <div>
                  <Text strong>Current Window:</Text>
                  <span style={{ marginLeft: 8 }}>
                    <Tag color="default" style={{ borderRadius: 4 }}>
                      #{settings.currentWindowNumber}
                    </Tag>
                  </span>
                </div>

                <div>
                  <Text strong>Enabled At:</Text>
                  <span style={{ marginLeft: 8 }}>
                    {settings.enabledAt
                      ? new Date(settings.enabledAt).toLocaleString("en-IN")
                      : "-"}
                  </span>
                </div>

                <div>
                  <Text strong>Disabled At:</Text>
                  <span style={{ marginLeft: 8 }}>
                    {settings.disabledAt
                      ? new Date(settings.disabledAt).toLocaleString("en-IN")
                      : "-"}
                  </span>
                </div>
              </div>

              <Divider />

              <Text type="secondary" style={{ fontSize: 12 }}>
                Feedback automatically opens on{" "}
                <b>25th of each month at 9 AM IST</b>. It auto-closes after 48
                hours unless manually controlled.
              </Text>
            </>
          ) : (
            <Text>No settings found.</Text>
          )}
        </Card>

        {/* Buttons */}
        <Space size="middle">
          <Button
            type="primary"
            onClick={() =>
              updateState("enable", "Feedback window enabled successfully.")
            }
            loading={actionLoading}
            disabled={settingsLoading || actionLoading || settings?.isEnabled}
          >
            Enable
          </Button>

          <Button
            danger
            onClick={() =>
              updateState("disable", "Feedback window disabled successfully.")
            }
            loading={actionLoading}
            disabled={settingsLoading || actionLoading || !settings?.isEnabled}
          >
            Disable
          </Button>
        </Space>
      </Space>
    </Card>
  );
}
