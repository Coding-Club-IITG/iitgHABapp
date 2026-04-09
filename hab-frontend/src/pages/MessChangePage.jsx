import { useState, useEffect, useMemo } from "react";
import {
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Input,
  Space,
  Divider,
} from "antd";
import {
  InfoCircleOutlined,
  TeamOutlined,
  BankOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { BACKEND_URL } from "../apis/server";
import SchedulePanel from "../components/SchedulePanel";

const { Title, Text } = Typography;
const { Search } = Input;

const MessChangePage = () => {
  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messChangeSettings, setMessChangeSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [hostels, setHostels] = useState([]);
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const buildHostelMap = (list) => {
    const map = {};
    (list || []).forEach((h) => {
      if (h && h._id) {
        map[String(h._id)] = h.hostel_name;
      }
    });
    return map;
  };

  const fetchRequests = async (hostelMapParam) => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/mess-change/all`, {
        headers: {
          ...authHeaders,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const hostelMap = hostelMapParam || buildHostelMap(hostels);
      const withNames = (data.data || []).map((req) => {
        const userHostelId = req.hostel;
        const userHostelIdStr = userHostelId ? String(userHostelId) : "";
        const pref1IdStr = req.next_mess1 ? String(req.next_mess1) : "";
        const pref2IdStr = req.next_mess2 ? String(req.next_mess2) : "";
        const pref3IdStr = req.next_mess3 ? String(req.next_mess3) : "";

        const preference1Name =
          hostelMap[pref1IdStr] || req.applied_hostel_string || "-";
        const preference2Name = hostelMap[pref2IdStr] || "-";
        const preference3Name = hostelMap[pref3IdStr] || "-";

        return {
          ...req,
          userHostelName: hostelMap[userHostelIdStr] || "Unknown",
          preference1Name,
          preference2Name,
          preference3Name,
        };
      });
      setRequests(withNames);
    } catch (error) {
      console.error("Error fetching requests:", error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessChangeSettings = async () => {
    try {
      setSettingsLoading(true);
      const response = await fetch(`${BACKEND_URL}/mess-change/settings`, {
        headers: {
          ...authHeaders,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMessChangeSettings(data.data);
    } catch (error) {
      console.error("Error fetching mess change settings:", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchHostels = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/hostel/all`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const list = Array.isArray(data)
        ? data
        : data?.hostels || data?.data || [];
      setHostels(list);
      return list;
    } catch (error) {
      console.error("Error fetching hostels:", error);
      setHostels([]);
      return [];
    }
  };

  const fetchScheduleInfo = async () => {
    try {
      setScheduleLoading(true);
      const response = await fetch(`${BACKEND_URL}/mess-change/schedule`, {
        headers: {
          ...authHeaders,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setScheduleInfo(data.data);
    } catch (error) {
      console.error("Error fetching schedule info:", error);
      setScheduleInfo(null);
    } finally {
      setScheduleLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const list = await fetchHostels();
      const hostelMap = buildHostelMap(list);
      await fetchRequests(hostelMap);
      await fetchMessChangeSettings();
      await fetchScheduleInfo();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeaders]);

  const stats = useMemo(() => {
    if (!requests || requests.length === 0) return null;

    const uniqueHostels = new Set();
    const prefCounts = {};

    requests.forEach((req) => {
      if (req.userHostelName && req.userHostelName !== "Unknown") {
        uniqueHostels.add(req.userHostelName);
      }

      const pref1 = req.preference1Name;
      if (pref1 && pref1 !== "-") {
        prefCounts[pref1] = (prefCounts[pref1] || 0) + 1;
      }
    });

    let mostRequested = "-";
    let maxCount = 0;
    Object.entries(prefCounts).forEach(([mess, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostRequested = mess;
      }
    });

    return {
      totalRequests: requests.length,
      uniqueHostelsCount: uniqueHostels.size,
      mostRequestedMess: mostRequested,
      mostRequestedCount: maxCount,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const query = searchQuery.toLowerCase();
    return requests.filter(
      (req) =>
        (req.name || "").toLowerCase().includes(query) ||
        (req.rollNumber || "").toLowerCase().includes(query) ||
        (req.userHostelName || "").toLowerCase().includes(query),
    );
  }, [requests, searchQuery]);

  const columns = [
    {
      title: "Sl. No",
      key: "index",
      render: (text, record, index) => index + 1,
      width: 70,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => (a.name || "").localeCompare(b.name || ""),
    },
    {
      title: "Roll Number",
      dataIndex: "rollNumber",
      key: "rollNumber",
      sorter: (a, b) => (a.rollNumber || "").localeCompare(b.rollNumber || ""),
    },
    {
      title: "Current Hostel",
      dataIndex: "userHostelName",
      key: "userHostelName",
      sorter: (a, b) =>
        (a.userHostelName || "").localeCompare(b.userHostelName || ""),
    },
    {
      title: "Preference 1",
      dataIndex: "preference1Name",
      key: "preference1Name",
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "Preference 2",
      dataIndex: "preference2Name",
      key: "preference2Name",
      render: (text) =>
        text !== "-" ? (
          <Tag color="cyan">{text}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "Preference 3",
      dataIndex: "preference3Name",
      key: "preference3Name",
      render: (text) =>
        text !== "-" ? (
          <Tag color="geekblue">{text}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "Applied At",
      dataIndex: "applied_hostel_timestamp",
      key: "appliedAt",
      render: (text) =>
        text
          ? new Date(text).toLocaleString("en-IN", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/A",
      sorter: (a, b) =>
        new Date(a.applied_hostel_timestamp || 0) -
        new Date(b.applied_hostel_timestamp || 0),
    },
  ];

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
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Mess Change
            </Title>
          </div>
        </div>

        <Row gutter={[24, 24]}>
          {/* Settings & Schedule Panel */}
          <Col xs={24} lg={8}>
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <Card
                title={
                  <>
                    <InfoCircleOutlined
                      style={{ color: "#1890ff", marginRight: 8 }}
                    />{" "}
                    Mess Change Control
                  </>
                }
                style={{
                  borderRadius: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
                loading={settingsLoading}
              >
                {messChangeSettings ? (
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text strong>Status:</Text>
                      {messChangeSettings.isEnabled ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                          Enabled
                        </Tag>
                      ) : (
                        <Tag color="error" icon={<StopOutlined />}>
                          Disabled
                        </Tag>
                      )}
                    </div>
                    <Divider style={{ margin: "12px 0" }} />
                    <div>
                      <Text
                        strong
                        style={{ display: "block", marginBottom: 4 }}
                      >
                        Last Processed:
                      </Text>
                      <Text type="secondary">
                        {messChangeSettings.lastProcessedAt
                          ? new Date(
                              messChangeSettings.lastProcessedAt,
                            ).toLocaleString("en-IN")
                          : "Never"}
                      </Text>
                    </div>
                  </Space>
                ) : (
                  <Text type="secondary">Unable to load settings</Text>
                )}
              </Card>

              <SchedulePanel
                scheduleInfo={scheduleInfo}
                loading={scheduleLoading}
              />
            </Space>
          </Col>

          {/* Statistics and Data Table */}
          <Col xs={24} lg={16}>
            {messChangeSettings?.isEnabled && (
              <>
                {/* Stats Row */}
                {stats && (
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} sm={8}>
                      <Card
                        style={{
                          borderRadius: 8,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                        }}
                        bodyStyle={{ padding: "16px 20px" }}
                      >
                        <Statistic
                          title="Total Responses"
                          value={stats.totalRequests}
                          prefix={<TeamOutlined style={{ color: "#1890ff" }} />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card
                        style={{
                          borderRadius: 8,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                        }}
                        bodyStyle={{ padding: "16px 20px" }}
                      >
                        <Statistic
                          title="Unique Hostels"
                          value={stats.uniqueHostelsCount}
                          prefix={<BankOutlined style={{ color: "#52c41a" }} />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card
                        style={{
                          borderRadius: 8,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                        }}
                        bodyStyle={{ padding: "16px 20px" }}
                      >
                        <Statistic
                          title="Most Requested"
                          value={stats.mostRequestedMess}
                          prefix={<SwapOutlined style={{ color: "#722ed1" }} />}
                          valueStyle={{ fontSize: 18 }}
                          suffix={
                            stats.mostRequestedCount > 0 ? (
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "#8c8c8c",
                                  marginLeft: 4,
                                }}
                              >
                                ({stats.mostRequestedCount})
                              </span>
                            ) : null
                          }
                        />
                      </Card>
                    </Col>
                  </Row>
                )}

                {/* Table Card */}
                <Card
                  title="Pending Requests"
                  extra={
                    <Search
                      placeholder="Search name, roll or hostel"
                      allowClear
                      onSearch={setSearchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: 250 }}
                    />
                  }
                  style={{
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}
                >
                  <Table
                    columns={columns}
                    dataSource={filteredRequests}
                    rowKey="_id"
                    loading={loading}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (total) => `Total ${total} requests`,
                    }}
                    scroll={{ x: 800 }}
                    size="middle"
                  />
                </Card>
              </>
            )}

            {!messChangeSettings?.isEnabled && (
              <Card
                style={{
                  borderRadius: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  textAlign: "center",
                  padding: "40px 20px",
                }}
              >
                <SwapOutlined
                  style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}
                />
                <Title level={4} style={{ color: "#595959" }}>
                  Mess Change is Currently Disabled
                </Title>
                <Text type="secondary">
                  Requests can only be viewed when the mess change window is
                  active.
                </Text>
              </Card>
            )}
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default MessChangePage;
