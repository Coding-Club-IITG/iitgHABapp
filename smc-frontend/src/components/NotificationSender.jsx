import React, { useState } from "react";
import apiClient from "../apiClient";
import Button from "./ui/Button";
import { useAuth } from "../context/AuthProvider";

const NotificationSender = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [userType, setUserType] = useState("boarders"); // 'boarders', 'subscribers'
  const [isAlert, setIsAlert] = useState(false);
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

      // Get hostel name from user's hostel
      const response = await apiClient.get(
        `/hostel/all/smc/${user.hostel}`,
      );
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
        isAlert,
      });

      setSuccess(true);
      setTitle("");
      setBody("");
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
