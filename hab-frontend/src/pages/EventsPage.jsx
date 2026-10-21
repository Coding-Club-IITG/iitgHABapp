import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Button, Typography, Tag, Space, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

import EventForm from "../components/EventForm";
import { createEvent, listEvents } from "../apis/events";

const { Title, Text } = Typography;

export default function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listEvents();
      setEvents(data.events || []);
    } catch (err) {
      message.error(err.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (values) => {
    setSaving(true);
    try {
      const data = await createEvent(values);
      message.success("Event created");
      setFormOpen(false);
      navigate(`/events/${data.event._id}`);
    } catch (err) {
      message.error(err.message || "Failed to create event");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: "Event",
      dataIndex: "title",
      render: (title, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          {record.venue && <Text type="secondary">{record.venue}</Text>}
        </Space>
      ),
    },
    {
      title: "Starts",
      dataIndex: "startsAt",
      render: (value) => dayjs(value).format("DD MMM YYYY, h:mm A"),
    },
    {
      title: "Registrations",
      render: (_, record) => (
        <Space wrap>
          <Tag color="green">{record.counts.approved} approved</Tag>
          {record.counts.pending > 0 && (
            <Tag color="gold">{record.counts.pending} pending</Tag>
          )}
          <Tag color="blue">{record.counts.checkedIn} entered</Tag>
        </Space>
      ),
    },
    {
      title: "Capacity",
      dataIndex: "capacity",
      render: (capacity) => (capacity > 0 ? capacity : "Unlimited"),
    },
    {
      title: "Status",
      render: (_, record) =>
        record.isPublished ? <Tag color="green">Visible</Tag> : <Tag>Hidden</Tag>,
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Title level={3} className="!mb-0">
            Events
          </Title>
          <Text type="secondary">
            Students register in the app and get a personal entry QR that
            volunteers scan at the gate.
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setFormOpen(true)}
        >
          Create event
        </Button>
      </div>
      <Table
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={events}
        onRow={(record) => ({
          onClick: () => navigate(`/events/${record._id}`),
          style: { cursor: "pointer" },
        })}
      />
      <EventForm
        open={formOpen}
        saving={saving}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
