import React, { useState, useEffect } from "react";
import { BACKEND_URL } from "../apis/server";
import { getAllHostelNamesAndCaterers } from "../apis/hostel";
import {
  Button,
  Input,
  Select,
  Checkbox,
  DatePicker,
  Typography,
  Space,
  Card,
  Row,
  Col,
} from "antd";
import { SendOutlined, NotificationOutlined } from "@ant-design/icons";
import { useAuth } from "../context/AuthProvider";

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

const Notifications = () => {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topicType, setTopicType] = useState("all"); // 'all', 'specific'
  const [userType, setUserType] = useState("boarders"); // 'boarders', 'subscribers'
  const [selectedHostel, setSelectedHostel] = useState(null);
  const [hostels, setHostels] = useState([]);
  const [isAlert, setIsAlert] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [hasCountdown, setHasCountdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch hostels for specific hostel selection
  useEffect(() => {
    const fetchHostels = async () => {
      try {
        const data = await getAllHostelNamesAndCaterers();
        const list = Array.isArray(data)
          ? data
          : data?.hostels || data?.data || [];
        setHostels(list);
      } catch (err) {
        console.error("Failed to fetch hostels:", err);
      }
    };
    fetchHostels();
  }, []);

  const handleSend = async () => {
    if (!title || !body) {
      alert("Please fill in title and body");
      return;
    }

    try {
      setLoading(true);
      setSuccess(false);

      const headers = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      let url = `${BACKEND_URL}/notification/send`;
      let payload = {};

      if (isAlert) {
        if (!endTime) {
          alert("Please select an end time for the alert");
          setLoading(false);
          return;
        }

        const ttlSeconds = Math.floor((endTime.valueOf() - Date.now()) / 1000);
        if (ttlSeconds <= 0) {
          alert("End time must be in the future");
          setLoading(false);
          return;
        }

        let targetType = "global";
        let targetIds = [];

        if (topicType === "specific") {
          if (!selectedHostel) {
            alert("Please select a hostel");
            setLoading(false);
            return;
          }
          targetType = userType === "boarders" ? "hostel" : "mess";
          targetIds = [selectedHostel];
        }

        url = `${BACKEND_URL}/alerts/create`;
        payload = {
          title,
          body,
          ttlSeconds,
          targetType,
          targetIds,
          hasCountdown,
        };
      } else {
        let topic = "";

        if (topicType === "all") {
          topic = "All_Hostels";
        } else {
          // Specific hostel
          if (!selectedHostel) {
            alert("Please select a hostel");
            setLoading(false);
            return;
          }
          const hostelName = hostels
            .find((h) => h._id === selectedHostel)
            ?.hostel_name.replaceAll(" ", "_");
          topic =
            userType === "boarders"
              ? `Boarders_${hostelName}`
              : `Subscribers_${hostelName}`;
        }

        payload = {
          title,
          body,
          topic,
          isAlert: false,
        };
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to send notification");
      }

      setSuccess(true);
      setTitle("");
      setBody("");
      setEndTime(null);
      setHasCountdown(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error sending notification:", err);
      alert("Failed to send notification: " + err.message);
    } finally {
      setLoading(false);
    }
  };

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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#fff",
            padding: "16px 24px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            marginBottom: "24px",
          }}
        >
          <Title level={2} style={{ margin: 0 }}>
            Send Notifications
          </Title>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card
              title={
                <>
                  <NotificationOutlined
                    style={{ color: "#1890ff", marginRight: 8 }}
                  />
                  Compose Message
                </>
              }
              style={{
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              <Space
                direction="vertical"
                size="large"
                style={{ width: "100%" }}
              >
                <div>
                  <Text strong style={{ display: "block", marginBottom: 8 }}>
                    Title
                  </Text>
                  <Input
                    size="large"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Notification title"
                  />
                </div>

                <div>
                  <Text strong style={{ display: "block", marginBottom: 8 }}>
                    Body
                  </Text>
                  <TextArea
                    size="large"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Notification message"
                    rows={4}
                  />
                </div>

                <div style={{ marginTop: "2px" }}>
                  <Checkbox
                    checked={isAlert}
                    onChange={(e) => setIsAlert(e.target.checked)}
                  >
                    <Text strong>Send as Alert (urgent notification)</Text>
                  </Checkbox>
                </div>

                {isAlert && (
                  <div
                    style={{
                      padding: "16px",
                      backgroundColor: "#fff1f0",
                      borderRadius: "8px",
                      border: "1px solid #ffa39e",
                    }}
                  >
                    <div style={{ marginBottom: "16px" }}>
                      <Text
                        strong
                        style={{
                          color: "#cf1322",
                          display: "block",
                          marginBottom: 8,
                        }}
                      >
                        Alert End Time
                      </Text>
                      <DatePicker
                        showTime
                        size="large"
                        value={endTime}
                        onChange={(date) => setEndTime(date)}
                        style={{ width: "100%" }}
                        placeholder="Select end time"
                      />
                      <Text
                        type="secondary"
                        style={{
                          fontSize: "12px",
                          color: "#cf1322",
                          display: "block",
                          marginTop: 4,
                        }}
                      >
                        The alert will automatically disappear from users' feeds
                        after this time.
                      </Text>
                    </div>

                    <div>
                      <Checkbox
                        checked={hasCountdown}
                        onChange={(e) => setHasCountdown(e.target.checked)}
                      >
                        <Text style={{ color: "#cf1322" }}>Show countdown</Text>
                      </Checkbox>
                    </div>
                  </div>
                )}
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card
              title="Target Audience"
              style={{
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              <Space
                direction="vertical"
                size="large"
                style={{ width: "100%" }}
              >
                <div>
                  <Text strong style={{ display: "block", marginBottom: 8 }}>
                    Send To
                  </Text>
                  <Select
                    size="large"
                    value={topicType}
                    onChange={setTopicType}
                    style={{ width: "100%" }}
                  >
                    <Option value="all">All Hostels</Option>
                    <Option value="specific">Specific Hostel</Option>
                  </Select>
                </div>

                <div>
                  <Text strong style={{ display: "block", marginBottom: 8 }}>
                    User Type
                  </Text>
                  <Select
                    size="large"
                    value={userType}
                    onChange={setUserType}
                    style={{ width: "100%" }}
                  >
                    <Option value="boarders">Boarders</Option>
                    <Option value="subscribers">Mess Subscribers</Option>
                  </Select>
                </div>

                {topicType === "specific" && (
                  <div>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>
                      Select Hostel
                    </Text>
                    <Select
                      size="large"
                      value={selectedHostel}
                      onChange={setSelectedHostel}
                      style={{ width: "100%" }}
                      placeholder="Select a hostel"
                      showSearch
                      optionFilterProp="children"
                    >
                      {hostels.map((hostel) => (
                        <Option key={hostel._id} value={hostel._id}>
                          {hostel.hostel_name}
                        </Option>
                      ))}
                    </Select>
                  </div>
                )}

                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={loading}
                  size="large"
                  style={{ width: "100%", marginTop: "16px" }}
                >
                  Send Notification
                </Button>

                {success && (
                  <div
                    style={{
                      color: "#52c41a",
                      textAlign: "center",
                      marginTop: "8px",
                    }}
                  >
                    Notification sent successfully!
                  </div>
                )}
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default Notifications;
