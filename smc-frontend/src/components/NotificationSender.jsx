import React, { useState } from "react";
import apiClient from "../apiClient";
import Button from "./ui/Button";
import { DatePicker } from "antd";
import { useAuth } from "../context/AuthProvider";

const NotificationSender = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [userType, setUserType] = useState("boarders"); // 'boarders', 'subscribers'
  const [isAlert, setIsAlert] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [hasCountdown, setHasCountdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();

  const handleSend = async () => {
    if (!title || !body) {
      alert("Please fill in title and body");
      return;
    }

    if (!user?.hostel) {
      alert("Hostel information not available");
      return;
    }

    try {
      setLoading(true);
      setSuccess(false);

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

        const targetType = userType === "boarders" ? "hostel" : "mess";
        const targetIds = [user.hostel];

        await apiClient.post("/alerts/create", {
          title,
          body,
          ttlSeconds,
          targetType,
          targetIds,
          hasCountdown,
        });
      } else {
        // Get hostel name from user's hostel
        const response = await apiClient.get(`/hostel/all/smc/${user.hostel}`);
        const hostelName =
          response.data.hostel?.hostel_name?.replaceAll(" ", "_") || "";

        const topic =
          userType === "boarders"
            ? `Boarders_${hostelName}`
            : `Subscribers_${hostelName}`;

        await apiClient.post("/notification/send", {
          title,
          body,
          topic,
          isAlert: false,
        });
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
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notification message"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">User Type</label>
          <select
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="boarders">Boarders of This Hostel</option>
            <option value="subscribers">
              Subscribers to This Hostel's Mess
            </option>
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAlert}
              onChange={(e) => setIsAlert(e.target.checked)}
            />
            <span>Send as Alert (urgent notification)</span>
          </label>
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasCountdown}
                  onChange={(e) => setHasCountdown(e.target.checked)}
                />
                <span className="text-red-900">
                  Show countdown timer to users
                </span>
              </label>
            </div>
          </div>
        )}

        <Button
          onClick={handleSend}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? "Sending..." : "Send Notification"}
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
