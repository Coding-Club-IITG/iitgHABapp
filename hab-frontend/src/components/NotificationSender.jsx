import React, { useState } from "react";
import { BACKEND_URL } from "../apis/server";
import { Button, Input, Select, Checkbox, DatePicker } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { useAuth } from "../context/AuthProvider";

const { TextArea } = Input;
const { Option } = Select;

const NotificationSender = () => {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topicType, setTopicType] = useState("all"); // 'all', 'specific'
  const [userType, setUserType] = useState("boarders"); // 'boarders', 'subscribers'
  const [selectedHostel, setSelectedHostel] = useState("");
  const [hostels, setHostels] = useState([]);
  const [isAlert, setIsAlert] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [hasCountdown, setHasCountdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch hostels for specific hostel selection
  React.useEffect(() => {
    const fetchHostels = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/hostel/all`);
        const data = await response.json();
        setHostels(data);
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
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4">Send Notification</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Body</label>
          <TextArea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notification message"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Send To</label>
          <Select
            value={topicType}
            onChange={setTopicType}
            className="w-full mb-2"
          >
            <Option value="all">All Hostels</Option>
            <Option value="specific">Specific Hostel</Option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">User Type</label>
          <Select
            value={userType}
            onChange={setUserType}
            className="w-full mb-2"
          >
            <Option value="boarders">Boarders</Option>
            <Option value="subscribers">Subscribers</Option>
          </Select>
        </div>

        {topicType === "specific" && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Select Hostel
            </label>
            <Select
              value={selectedHostel}
              onChange={setSelectedHostel}
              className="w-full"
              placeholder="Select a hostel"
            >
              {hostels.map((hostel) => (
                <Option key={hostel._id} value={hostel._id}>
                  {hostel.hostel_name}
                </Option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Checkbox
            checked={isAlert}
            onChange={(e) => setIsAlert(e.target.checked)}
          >
            Send as Alert (urgent notification)
          </Checkbox>
        </div>

        {isAlert && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-red-900 mb-1">
                Alert End Time
              </label>
              <DatePicker
                showTime
                value={endTime}
                onChange={(date) => setEndTime(date)}
                className="w-full"
                placeholder="Select end time"
              />
              <p className="text-xs text-red-600 mt-1">
                The alert will automatically disappear from users' feeds after
                this time.
              </p>
            </div>

            <div>
              <Checkbox
                checked={hasCountdown}
                onChange={(e) => setHasCountdown(e.target.checked)}
              >
                <span className="text-red-900">
                  Show countdown timer to users
                </span>
              </Checkbox>
            </div>
          </div>
        )}

        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          className="w-full"
        >
          Send Notification
        </Button>

        {success && (
          <div className="text-green-600 text-center">
            Notification sent successfully!
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationSender;
