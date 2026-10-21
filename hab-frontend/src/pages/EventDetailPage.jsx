import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  Descriptions,
  Input,
  Modal,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

import EventForm from "../components/EventForm";
import {
  approveRegistration,
  deleteEvent,
  getEvent,
  listRegistrations,
  rejectRegistration,
  setVolunteerCode,
  setVolunteers,
  updateEvent,
} from "../apis/events";

const { Title, Text } = Typography;

const STATUS_COLORS = { approved: "green", pending: "gold", rejected: "red" };
const formatTime = (value) =>
  value ? dayjs(value).format("DD MMM YYYY, h:mm A") : "—";

export default function EventDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [stats, setStats] = useState({ approved: 0, checkedIn: 0 });
  const [registrations, setRegistrations] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [volunteerInput, setVolunteerInput] = useState("");
  const [savingVolunteers, setSavingVolunteers] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [savingCode, setSavingCode] = useState(false);

  const loadEvent = useCallback(async () => {
    try {
      const data = await getEvent(eventId);
      setEvent(data.event);
      setStats(data.stats);
      setVolunteerInput(
        (data.event.volunteers || []).map((v) => v.rollNumber).join("\n"),
      );
    } catch (err) {
      message.error(err.message || "Failed to load event");
    }
  }, [eventId]);

  const loadRegistrations = useCallback(async () => {
    setLoadingRegs(true);
    try {
      const data = await listRegistrations(
        eventId,
        statusFilter === "all" ? undefined : statusFilter,
      );
      setRegistrations(data.registrations || []);
    } catch (err) {
      message.error(err.message || "Failed to load registrations");
    } finally {
      setLoadingRegs(false);
    }
  }, [eventId, statusFilter]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  const act = async (fn, registration, successText) => {
    setActingId(registration._id);
    try {
      await fn(eventId, registration._id);
      message.success(successText);
      await Promise.all([loadRegistrations(), loadEvent()]);
    } catch (err) {
      message.error(err.message || "Action failed");
    } finally {
      setActingId(null);
    }
  };

  const handleUpdate = async (values) => {
    setSaving(true);
    try {
      await updateEvent(eventId, values);
      message.success("Event updated");
      setFormOpen(false);
      loadEvent();
    } catch (err) {
      message.error(err.message || "Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: "Delete this event?",
      content:
        "All registrations and entry QRs for this event will be deleted. This cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await deleteEvent(eventId);
          message.success("Event deleted");
          navigate("/events");
        } catch (err) {
          message.error(err.message || "Failed to delete event");
        }
      },
    });
  };

  const handleSaveVolunteers = async () => {
    const rollNumbers = volunteerInput
      .split(/[\s,]+/)
      .map((r) => r.trim())
      .filter(Boolean);
    setSavingVolunteers(true);
    try {
      const data = await setVolunteers(eventId, rollNumbers);
      if (data.notFound?.length) {
        message.warning(
          `Saved. No student found for: ${data.notFound.join(", ")}`,
          6,
        );
      } else {
        message.success("Volunteers updated");
      }
      loadEvent();
    } catch (err) {
      message.error(err.message || "Failed to update volunteers");
    } finally {
      setSavingVolunteers(false);
    }
  };

  const handleSetCode = async (code) => {
    setSavingCode(true);
    try {
      const data = await setVolunteerCode(eventId, code);
      setEvent((prev) => ({ ...prev, volunteerCode: data.volunteerCode }));
      setCodeInput("");
      message.success(`Access code is now ${data.volunteerCode}`);
    } catch (err) {
      message.error(err.message || "Failed to update access code");
    } finally {
      setSavingCode(false);
    }
  };

  const columns = [
    {
      title: "Student",
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.user?.name || "Deleted user"}</Text>
          <Text type="secondary">
            {[r.user?.rollNumber, r.user?.hostel?.hostel_name]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </Space>
      ),
    },
    {
      title: "Registered",
      dataIndex: "createdAt",
      render: formatTime,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status) => <Tag color={STATUS_COLORS[status]}>{status}</Tag>,
    },
    {
      title: "Entry",
      render: (_, r) =>
        r.checkedInAt ? (
          <Space direction="vertical" size={0}>
            <Text>{formatTime(r.checkedInAt)}</Text>
            {r.checkedInBy && (
              <Text type="secondary">by {r.checkedInBy.name}</Text>
            )}
          </Space>
        ) : (
          "—"
        ),
    },
    {
      title: "",
      render: (_, r) =>
        r.checkedInAt ? null : (
          <Space>
            {r.status !== "approved" && (
              <Button
                size="small"
                type="primary"
                loading={actingId === r._id}
                onClick={() => act(approveRegistration, r, "Approved")}
              >
                Approve
              </Button>
            )}
            {r.status !== "rejected" && (
              <Button
                size="small"
                danger
                loading={actingId === r._id}
                onClick={() => act(rejectRegistration, r, "Rejected")}
              >
                Reject
              </Button>
            )}
          </Space>
        ),
    },
  ];

  if (!event) {
    return <div className="p-6">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        className="!px-0"
        onClick={() => navigate("/events")}
      >
        All events
      </Button>

      <div className="flex items-center justify-between">
        <Title level={3} className="!mb-0">
          {event.title}
        </Title>
        <Space>
          <Button onClick={() => setFormOpen(true)}>Edit</Button>
          <Button danger onClick={handleDelete}>
            Delete
          </Button>
        </Space>
      </div>

      <Card>
        <Descriptions column={{ xs: 1, md: 2 }} size="small">
          <Descriptions.Item label="Starts">
            {formatTime(event.startsAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Ends">{formatTime(event.endsAt)}</Descriptions.Item>
          <Descriptions.Item label="Venue">{event.venue || "—"}</Descriptions.Item>
          <Descriptions.Item label="Registrations close">
            {formatTime(
              event.registrationClosesAt || event.endsAt || event.startsAt,
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Capacity">
            {event.capacity > 0 ? event.capacity : "Unlimited"}
          </Descriptions.Item>
          <Descriptions.Item label="Approval">
            {event.requiresApproval ? "Manual" : "Automatic"}
          </Descriptions.Item>
          <Descriptions.Item label="Visible in app">
            {event.isPublished ? "Yes" : "No"}
          </Descriptions.Item>
        </Descriptions>
        {event.description && (
          <Text type="secondary" className="block mt-2 whitespace-pre-line">
            {event.description}
          </Text>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <Statistic title="Approved" value={stats.approved} />
        </Card>
        <Card>
          <Statistic title="Entered" value={stats.checkedIn} />
        </Card>
        <Card>
          <Statistic
            title="Seats left"
            value={
              event.capacity > 0
                ? Math.max(event.capacity - event.approvedCount, 0)
                : "∞"
            }
          />
        </Card>
      </div>

      <Card title="Volunteers">
        <Text type="secondary" className="block mb-2">
          Share this access code with your volunteers. Anyone who enters it on
          this event in the app gets the Volunteer tab and can scan entry QRs.
        </Text>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Text
            copyable={{ text: event.volunteerCode }}
            className="!text-2xl font-mono tracking-widest"
          >
            {event.volunteerCode || "—"}
          </Text>
          <Space.Compact>
            <Input
              placeholder="Set your own code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onPressEnter={() => codeInput.trim() && handleSetCode(codeInput)}
              style={{ width: 200 }}
            />
            <Button
              loading={savingCode}
              disabled={!codeInput.trim()}
              onClick={() => handleSetCode(codeInput)}
            >
              Save
            </Button>
          </Space.Compact>
          <Button
            icon={<ReloadOutlined />}
            loading={savingCode}
            onClick={() =>
              Modal.confirm({
                title: "Generate a new access code?",
                content:
                  "The old code stops working. Existing volunteers keep access.",
                onOk: () => handleSetCode(),
              })
            }
          >
            Generate new
          </Button>
        </div>
        <Text type="secondary" className="block mb-2">
          Current volunteers, by roll number (one per line). You can also add
          or remove volunteers here directly.
        </Text>
        <Input.TextArea
          rows={4}
          value={volunteerInput}
          onChange={(e) => setVolunteerInput(e.target.value)}
          placeholder={"220101001\n220101002"}
        />
        <div className="flex items-center justify-between mt-2">
          <Text type="secondary">
            {(event.volunteers || []).map((v) => v.name).join(", ") ||
              "No volunteers yet"}
          </Text>
          <Button
            type="primary"
            loading={savingVolunteers}
            onClick={handleSaveVolunteers}
          >
            Save volunteers
          </Button>
        </div>
      </Card>

      <Card
        title="Registrations"
        extra={
          <Segmented
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: "All", value: "all" },
              { label: "Pending", value: "pending" },
              { label: "Approved", value: "approved" },
              { label: "Rejected", value: "rejected" },
            ]}
          />
        }
      >
        <Table
          rowKey="_id"
          loading={loadingRegs}
          columns={columns}
          dataSource={registrations}
        />
      </Card>

      <EventForm
        open={formOpen}
        initial={event}
        saving={saving}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
