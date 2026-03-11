import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../apis/server";
import { Table, Button, Typography, DatePicker, TimePicker, message, Modal } from "antd";
import { PlusOutlined, DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title } = Typography;

export default function GalaDinnerPage() {
  const navigate = useNavigate();
  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleDate, setScheduleDate] = useState(null);
  const [startersServingStartTime, setStartersServingStartTime] = useState(null);
  const [dinnerServingStartTime, setDinnerServingStartTime] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const schedulingRef = useRef(false);

  const fetchList = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const response = await fetch(`${BACKEND_URL}/gala/list`, {
          headers: { ...authHeaders },
        });
        if (!response.ok) throw new Error("Fetch failed");
        const data = await response.json();
        setList(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!silent) {
          console.error("Failed to fetch Gala Dinners:", err);
          message.error("Failed to load Gala Dinners");
        }
        if (!silent) setList([]);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [authHeaders]
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSchedule = async () => {
    if (schedulingRef.current) return;
    if (!scheduleDate) {
      message.warning("Please select a date");
      return;
    }
    if (!startersServingStartTime) {
      message.warning("Please select Starters serving start time");
      return;
    }
    if (!dinnerServingStartTime) {
      message.warning("Please select Dinner serving start time");
      return;
    }
    schedulingRef.current = true;
    setScheduling(true);
    try {
      const response = await fetch(`${BACKEND_URL}/gala/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          date: scheduleDate.toISOString(),
          startersServingStartTime: startersServingStartTime.format("HH:mm"),
          dinnerServingStartTime: dinnerServingStartTime.format("HH:mm"),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMsg = data.message || "Schedule failed";
        message.error(errorMsg);
        return;
      }
      message.success("Gala Dinner scheduled successfully");
      setScheduleDate(null);
      setStartersServingStartTime(null);
      setDinnerServingStartTime(null);
      // Optimistic update: add new gala to list immediately so table refreshes
      if (data.galaDinner && data.galaDinner._id) {
        setList((prev) => [
          { _id: data.galaDinner._id, date: data.galaDinner.date },
          ...prev,
        ]);
      }
      // Sync full list from server (silent = no loading spinner)
      await fetchList(true);
    } catch (err) {
      message.error(err.message || "Failed to schedule Gala Dinner");
    } finally {
      setScheduling(false);
      schedulingRef.current = false;
    }
  };

  const handleClearSchedule = (record) => {
    Modal.confirm({
      title: "Clear this Gala Dinner?",
      content: `This will remove the schedule for ${dayjs(record.date).format("DD MMM YYYY")} and all related menus, items, and scan data. This cannot be undone.`,
      okText: "Clear",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        setDeletingId(record._id);
        try {
          const response = await fetch(
            `${BACKEND_URL}/gala/${record._id}`,
            { method: "DELETE", headers: { ...authHeaders } }
          );
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            message.error(data.message || "Failed to clear schedule");
            return;
          }
          message.success("Gala Dinner cleared successfully");
          setList((prev) => prev.filter((g) => g._id !== record._id));
        } catch (err) {
          message.error(err.message || "Failed to clear schedule");
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (date) =>
        date ? dayjs(date).format("DD MMM YYYY") : "-",
    },
    {
      title: "Status",
      key: "status",
      render: (_, record) => {
        const d = record.date ? dayjs(record.date) : null;
        const today = dayjs().startOf("day");
        if (!d) return "-";
        return d.isBefore(today) ? "Completed" : "Scheduled";
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <span className="flex items-center gap-2">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/gala-dinner/${record._id}`)}
          >
            View
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={deletingId === record._id}
            onClick={() => handleClearSchedule(record)}
          >
            Clear
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Title level={4} className="!mb-0">
          Gala Dinner
        </Title>
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            value={scheduleDate}
            onChange={setScheduleDate}
            format="DD MMM YYYY"
            placeholder="Select date"
            disabled={scheduling}
            disabledDate={(current) => {
              if (!current) return false;
              if (current < dayjs().startOf("day")) return true;
              const dateStr = current.format("YYYY-MM-DD");
              return list.some(
                (g) =>
                  g.date &&
                  dayjs(g.date).format("YYYY-MM-DD") === dateStr
              );
            }}
          />
          <TimePicker
            value={startersServingStartTime}
            onChange={setStartersServingStartTime}
            format="h:mm A"
            placeholder="Starters at"
            disabled={scheduling}
            minuteStep={5}
          />
          <TimePicker
            value={dinnerServingStartTime}
            onChange={setDinnerServingStartTime}
            format="h:mm A"
            placeholder="Dinner at"
            disabled={scheduling}
            minuteStep={5}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleSchedule}
            loading={scheduling}
            disabled={scheduling || !scheduleDate || !startersServingStartTime || !dinnerServingStartTime}
          >
            Schedule Gala Dinner
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <Table
          dataSource={list}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>
    </div>
  );
}
