import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  TeamOutlined,
} from "@ant-design/icons";

import { getAllHostels } from "../apis/hostel";
import {
  activateSummerMess,
  getSummerMessSettings,
  restoreSummerMess,
  saveSummerMessSettings,
  deleteSummerMessSeason,
} from "../apis/summerMess";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const EMPTY_FORM_STATE = {
  seasonKey: "",
  seasonLabel: "",
  registrationRange: null,
  summerRange: null,
  ratePerDay: "",
  participatingHostelIds: [],
};

function normalizeHostels(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.hostels)) return payload.hostels;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function hostelOptionLabel(hostel) {
  const hostelName = hostel?.hostel_name || "Unknown hostel";
  const messName =
    typeof hostel?.messId === "object" && hostel?.messId?.name
      ? hostel.messId.name
      : "";
  return messName ? `${hostelName} (${messName})` : hostelName;
}

function formatDateTime(value) {
  if (!value) return "Not set";
  return dayjs(value).format("DD MMM YYYY, hh:mm A");
}

function toDayjs(value) {
  return value ? dayjs(value) : null;
}

function toIsoString(value) {
  return value ? value.toDate().toISOString() : null;
}

function normalizeRangeWithBoundaryTimes(range) {
  if (!Array.isArray(range) || range.length !== 2) return range;

  const [start, end] = range;
  if (!start || !end) return range;

  return [
    start.hour(0).minute(1).second(0).millisecond(0),
    end.hour(23).minute(59).second(0).millisecond(0),
  ];
}

export default function SummerMessPage() {
  const navigate = useNavigate();
  const { seasonId } = useParams();
  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");

  const [settings, setSettings] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [meta, setMeta] = useState({
    selectedSeasonId: null,
    activeSeason: null,
    openRegistrationSeason: null,
  });
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formState, setFormState] = useState(EMPTY_FORM_STATE);

  const applySettingsToForm = useCallback((nextSettings) => {
    const participatingHostelIds = Array.isArray(nextSettings?.participatingHostels)
      ? nextSettings.participatingHostels
          .map((hostel) =>
            typeof hostel === "string" ? hostel : hostel?._id?.toString() || "",
          )
          .filter(Boolean)
      : [];

    setFormState({
      seasonKey: nextSettings?.seasonKey || "",
      seasonLabel: nextSettings?.seasonLabel || "",
      registrationRange:
        nextSettings?.registrationStartAt && nextSettings?.registrationEndAt
          ? [
              toDayjs(nextSettings?.registrationStartAt),
              toDayjs(nextSettings?.registrationEndAt),
            ]
          : null,
      summerRange:
        nextSettings?.summerStartAt && nextSettings?.summerEndAt
          ? [
              toDayjs(nextSettings?.summerStartAt),
              toDayjs(nextSettings?.summerEndAt),
            ]
          : null,
      ratePerDay:
        nextSettings?.ratePerDay === 0 || nextSettings?.ratePerDay
          ? String(nextSettings.ratePerDay)
          : "",
      participatingHostelIds,
    });
  }, []);

  const applyAdminPayload = useCallback(
    (payload, fallbackSeasonId = null) => {
      const nextSettings = payload?.settings || null;
      const nextSeasons = Array.isArray(payload?.seasons) ? payload.seasons : [];
      const nextMeta = payload?.meta || {
        selectedSeasonId: null,
        activeSeason: null,
        openRegistrationSeason: null,
      };
      const resolvedSeasonId =
        nextMeta?.selectedSeasonId ||
        nextSettings?._id?.toString() ||
        fallbackSeasonId ||
        null;

      setSettings(nextSettings);
      setSeasons(nextSeasons);
      setMeta(nextMeta);
      setSelectedSeasonId(resolvedSeasonId);
      applySettingsToForm(nextSettings);
    },
    [applySettingsToForm],
  );

  const loadPageData = useCallback(
    async (seasonIdToLoad = null) => {
      try {
        setLoading(true);
        setError("");

        const [hostelsPayload, settingsPayload] = await Promise.all([
          getAllHostels(),
          getSummerMessSettings(
            seasonIdToLoad ? { seasonId: seasonIdToLoad } : {},
          ),
        ]);

        setHostels(normalizeHostels(hostelsPayload));
        applyAdminPayload(settingsPayload, seasonIdToLoad);
      } catch (nextError) {
        console.error("Failed to load summer mess settings:", nextError);
        setError(
          nextError?.response?.data?.message ||
            nextError?.message ||
            "Failed to load summer mess settings",
        );
      } finally {
        setLoading(false);
      }
    },
    [applyAdminPayload],
  );

  // Load hostels whenever token changes
  useEffect(() => {
    if (!token) return;

    getAllHostels()
      .then((payload) => {
        setHostels(normalizeHostels(payload));
      })
      .catch((err) => {
        console.error("Failed to load hostels:", err);
      });
  }, [token]);

  // Load season-specific settings
  useEffect(() => {
    if (!token) {
      setError("Not authenticated as HAB admin.");
      setLoading(false);
      return;
    }

    if (seasonId === "new") {
      setSelectedSeasonId(null);
      setSettings(null);
      setError("");
      applySettingsToForm(null);
      setLoading(false);
      return;
    }

    setSelectedSeasonId(seasonId || null);
    if (seasonId) {
      loadPageData(seasonId);
    }
  }, [applySettingsToForm, loadPageData, seasonId, token]);

  const messHostels = useMemo(
    () =>
      [...hostels]
        .filter((hostel) => Boolean(hostel?.messId))
        .sort((a, b) =>
          (a?.hostel_name || "").localeCompare(b?.hostel_name || ""),
        ),
    [hostels],
  );

  const selectedSeasonSummary = useMemo(
    () =>
      seasons.find((season) => String(season?._id) === String(selectedSeasonId)) ||
      null,
    [seasons, selectedSeasonId],
  );

  const participatingIds = formState.participatingHostelIds;

  const participatingHostels = useMemo(
    () =>
      messHostels.filter((hostel) =>
        participatingIds.includes(hostel?._id?.toString()),
      ),
    [messHostels, participatingIds],
  );

  const excludedHostels = useMemo(
    () =>
      messHostels.filter(
        (hostel) => !participatingIds.includes(hostel?._id?.toString()),
      ),
    [messHostels, participatingIds],
  );

  const hostelOptions = useMemo(
    () =>
      messHostels.map((hostel) => ({
        value: hostel?._id?.toString(),
        label: hostelOptionLabel(hostel),
      })),
    [messHostels],
  );

  const updateForm = (patch) => {
    setFormState((current) => ({
      ...current,
      ...patch,
    }));
  };

  const refreshSettings = async () => {
    await loadPageData(selectedSeasonId);
  };

  const handleSelectSeason = async (value) => {
    const nextSeasonId = value || null;
    setSelectedSeasonId(nextSeasonId);
    navigate(nextSeasonId ? `/summer-mess/${nextSeasonId}` : "/summer-mess", {
      replace: true,
    });
    await loadPageData(nextSeasonId);
  };

  const handleCreateNewSeason = () => {
    setSelectedSeasonId(null);
    navigate("/summer-mess/new", { replace: true });
    setSettings(null);
    setError("");
    applySettingsToForm(null);
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError("");

      const registrationRange = formState.registrationRange;
      const summerRange = normalizeRangeWithBoundaryTimes(formState.summerRange);

      const payload = {
        seasonId: selectedSeasonId,
        seasonKey: formState.seasonKey.trim(),
        seasonLabel: formState.seasonLabel.trim(),
        registrationStartAt: toIsoString(registrationRange?.[0]),
        registrationEndAt: toIsoString(registrationRange?.[1]),
        summerStartAt: toIsoString(summerRange?.[0]),
        summerEndAt: toIsoString(summerRange?.[1]),
        ratePerDay:
          formState.ratePerDay === "" ? 0 : Number(formState.ratePerDay),
        participatingHostelIds: formState.participatingHostelIds,
      };

      const response = await saveSummerMessSettings(payload);
      applyAdminPayload(response, response?.meta?.selectedSeasonId || null);
      message.success(
        response?.message ||
          (selectedSeasonId
            ? "Summer mess settings saved"
            : "Summer mess season created"),
      );
    } catch (nextError) {
      const nextMessage =
        nextError?.response?.data?.message ||
        nextError?.message ||
        "Failed to save summer mess settings";
      setError(nextMessage);
      message.error(nextMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <Button type="link" onClick={() => navigate("/summer-mess")}>
          Back to season list
        </Button>
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={handleCreateNewSeason}>
            New Season
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshSettings}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {error ? (
        <Alert
          type="error"
          showIcon
          message="Summer mess setup error"
          description={error}
          style={{ marginBottom: 24 }}
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card
            title={selectedSeasonId ? "Season Configuration" : "Create New Season"}
            loading={loading}
            extra={
              <Space>
                {selectedSeasonId ? (
                  <Button danger onClick={async () => {
                    Modal.confirm({
                      title: 'Delete season?',
                      content: 'This will delete the selected season and all its applications. This action is irreversible.',
                      okText: 'Delete',
                      okType: 'danger',
                      cancelText: 'Keep',
                      onOk: async () => {
                        try {
                          await deleteSummerMessSeason(selectedSeasonId);
                          message.success('Season deleted');
                          navigate('/summer-mess');
                        } catch (err) {
                          const msg = err?.response?.data?.message || err?.message || 'Failed to delete season';
                          message.error(msg);
                        }
                      },
                    });
                  }}>
                    Delete Season
                  </Button>
                ) : null}
                <Button type="primary" onClick={handleSaveSettings} loading={saving}>
                  {selectedSeasonId ? "Save Settings" : "Create Season"}
                </Button>
              </Space>
            }
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Text strong>Season Label</Text>
                <Input
                  value={formState.seasonLabel}
                  onChange={(event) =>
                    updateForm({ seasonLabel: event.target.value })
                  }
                  placeholder="Summer 2026 Block 2"
                  style={{ marginTop: 8 }}
                />
              </Col>
              <Col xs={24} md={12}>
                <Text strong>Season Key</Text>
                <Input
                  value={formState.seasonKey}
                  onChange={(event) =>
                    updateForm({ seasonKey: event.target.value })
                  }
                  placeholder="summer-2026-block-2"
                  style={{ marginTop: 8 }}
                />
              </Col>
              <Col xs={24}>
                <Text strong>Registration Window</Text>
                <RangePicker
                  showTime
                  value={formState.registrationRange}
                  onChange={(value) =>
                    updateForm({ registrationRange: value })
                  }
                  style={{ marginTop: 8, width: "100%" }}
                  format="DD MMM YYYY hh:mm A"
                />
              </Col>
              <Col xs={24}>
                <Text strong>Summer Access Window</Text>
                <RangePicker
                  showTime
                  value={formState.summerRange}
                  onChange={(value) =>
                    updateForm({
                      summerRange: normalizeRangeWithBoundaryTimes(value),
                    })
                  }
                  style={{ marginTop: 8, width: "100%" }}
                  format="DD MMM YYYY hh:mm A"
                />
                <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                  This date range cannot overlap with any other saved summer
                  mess season.
                </Text>
              </Col>
              <Col xs={24} md={12}>
                <Text strong>Rate Per Day (INR)</Text>
                <Input
                  type="number"
                  min={0}
                  value={formState.ratePerDay}
                  onChange={(event) =>
                    updateForm({ ratePerDay: event.target.value })
                  }
                  placeholder="0"
                  style={{ marginTop: 8 }}
                />
              </Col>
              <Col xs={24}>
                <Text strong>Participating Hostels</Text>
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={formState.participatingHostelIds}
                  onChange={(value) =>
                    updateForm({ participatingHostelIds: value })
                  }
                  options={hostelOptions}
                  placeholder="Select hostels whose caterers are serving during this summer season"
                  style={{ marginTop: 8, width: "100%" }}
                />
                <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                  Leave a hostel out if its caterer is closed for this season.
                  Students will not be able to apply there.
                </Text>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Card title="Operations" loading={loading}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <div className="flex items-center justify-between">
                <Text strong>Selected Registration</Text>
                {selectedSeasonSummary?.registration?.isOpen ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    Open
                  </Tag>
                ) : (
                  <Tag color="default" icon={<StopOutlined />}>
                    Closed
                  </Tag>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Text strong>Selected Summer</Text>
                {selectedSeasonSummary?.summer?.isActive ? (
                  <Tag color="orange" icon={<CheckCircleOutlined />}>
                    Active
                  </Tag>
                ) : (
                  <Tag color="default" icon={<StopOutlined />}>
                    Inactive
                  </Tag>
                )}
              </div>

              <Divider style={{ margin: "4px 0" }} />

              <div>
                <Text strong>Registration Window</Text>
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary">
                    {formatDateTime(settings?.registrationStartAt)} to{" "}
                    {formatDateTime(settings?.registrationEndAt)}
                  </Text>
                </div>
              </div>
              <div>
                <Text strong>Summer Window</Text>
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary">
                    {formatDateTime(settings?.summerStartAt)} to{" "}
                    {formatDateTime(settings?.summerEndAt)}
                  </Text>
                </div>
              </div>

            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={12}>
          <Card
            title={`Participating Hostels (${participatingHostels.length})`}
            loading={loading}
          >
            {participatingHostels.length ? (
              <Space wrap>
                {participatingHostels.map((hostel) => (
                  <Tag key={hostel._id} color="green" style={{ padding: "6px 10px" }}>
                    {hostelOptionLabel(hostel)}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">
                No summer hostels selected yet. Save settings after choosing the
                caterers who will continue serving food in this season.
              </Text>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card
            title={`Excluded / Closed Caterers (${excludedHostels.length})`}
            loading={loading}
          >
            {excludedHostels.length ? (
              <Space wrap>
                {excludedHostels.map((hostel) => (
                  <Tag key={hostel._id} style={{ padding: "6px 10px" }}>
                    {hostelOptionLabel(hostel)}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">
                Every hostel with an assigned caterer is currently participating
                in this selected season.
              </Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
