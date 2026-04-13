// Students.jsx (Main Component)
import React, { useEffect, useState } from "react";
import {
  Button,
  Modal,
  message,
  Popconfirm,
  Switch,
  Tooltip,
  Upload,
  Typography,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import axios from "axios";
import StudentList from "../components/StudentList";
import {
  getProfileSettings,
  enableProfilePhotoChange,
  disableProfilePhotoChange,
} from "../apis/profile";
import { BACKEND_URL } from "../apis/server";

const { Title } = Typography;

const Students = () => {
  // refreshTrigger previously used for mass clear reload; retained if future manual reload needed.
  const [refreshTrigger] = useState(0);
  const [ppEnabled, setPpEnabled] = useState(false);
  const [ppLoading, setPpLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false); // confirm for enabling
  // Allocate Hostel (CSV) modal state
  const [allocOpen, setAllocOpen] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Note: Removed mass clear action per request

  // Fetch current profile photo change setting
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setPpLoading(true);
        const token =
          localStorage.getItem("admin_token") || localStorage.getItem("token");
        const data = await getProfileSettings(token);
        setPpEnabled(Boolean(data?.allowProfilePhotoChange));
      } catch (e) {
        message.error(
          `Failed to load profile settings: ${
            e?.response?.data?.message || e.message || e
          }`,
        );
      } finally {
        setPpLoading(false);
      }
    };
    loadSettings();
  }, []);

  const toggleProfilePhotos = (val) => {
    const token =
      localStorage.getItem("admin_token") || localStorage.getItem("token");

    // Optimistic update for better UX
    if (val) {
      // Open inline confirm popover; don't flip state yet
      setConfirmOpen(true);
    } else {
      // Turning OFF immediately
      (async () => {
        try {
          setPpLoading(true);
          setPpEnabled(false);
          await disableProfilePhotoChange(token);
          message.success("Profile photo change disabled");
        } catch (e) {
          setPpEnabled(true); // revert on failure
          const msg =
            e?.response?.data?.message || e.message || "Failed to disable";
          message.error(msg);
        } finally {
          setPpLoading(false);
        }
      })();
    }
  };

  const confirmEnable = async () => {
    const token =
      localStorage.getItem("admin_token") || localStorage.getItem("token");
    try {
      setPpLoading(true);
      await enableProfilePhotoChange(token);
      setPpEnabled(true);
      message.success("Profile photo change enabled");
    } catch (e) {
      setPpEnabled(false);
      const msg = e?.response?.data?.message || e.message || "Failed to enable";
      message.error(msg);
    } finally {
      setPpLoading(false);
      setConfirmOpen(false);
    }
  };

  // Upload props for CSV
  const uploadProps = {
    onRemove: (file) => {
      setFileList((prev) => {
        const index = prev.indexOf(file);
        const newFileList = prev.slice();
        newFileList.splice(index, 1);
        return newFileList;
      });
    },
    beforeUpload: (file) => {
      const isCsv = file.type === "text/csv" || file.name.endsWith(".csv");
      if (!isCsv) {
        message.error("Please upload a CSV file");
        return Upload.LIST_IGNORE;
      }
      setFileList([file]);
      return false; // prevent auto upload
    },
    fileList,
    accept: ".csv",
    maxCount: 1,
  };

  const handleAllocUpload = async () => {
    if (fileList.length === 0) {
      message.warning("Please select a CSV file first");
      return;
    }
    const token =
      localStorage.getItem("token") || localStorage.getItem("admin_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const formData = new FormData();
    formData.append("file", fileList[0]);

    try {
      setUploading(true);
      const { data } = await axios.post(
        `${BACKEND_URL}/hostel/alloc/upload`,
        formData,
        {
          headers: {
            ...headers,
            "Content-Type": "multipart/form-data",
          },
        },
      );
      message.success(
        `Upload completed. Processed: ${data.processed}, Errors: ${data.errors}`,
      );
      setFileList([]);
      setAllocOpen(false);
      // trigger refresh of student list if needed
      // setRefreshTrigger((prev) => prev + 1);
    } catch (e) {
      console.error(e);
      message.error("Failed to upload allocation CSV");
    } finally {
      setUploading(false);
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
            background: "#fff",
            padding: "16px 24px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <Title level={2} style={{ margin: 0 }}>
            Student Management
          </Title>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Tooltip title="Allow students to change their profile picture in the app">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#64748b", fontSize: 14 }}>
                  Profile photos
                </span>
                <Popconfirm
                  title="Enable profile photo changes?"
                  description={
                    <div>
                      Students will be able to change their profile picture in
                      the app.
                      <br /> You can disable this again anytime.
                    </div>
                  }
                  okText="Enable"
                  cancelText="Cancel"
                  open={confirmOpen}
                  onConfirm={confirmEnable}
                  onCancel={() => setConfirmOpen(false)}
                >
                  <Switch
                    checkedChildren="On"
                    unCheckedChildren="Off"
                    checked={ppEnabled}
                    loading={ppLoading}
                    onChange={toggleProfilePhotos}
                  />
                </Popconfirm>
              </div>
            </Tooltip>

            {/* Allocate Hostel (CSV) */}
            <Tooltip title="Upload CSV to allocate hostel to students by roll number">
              <Button
                icon={<UploadOutlined />}
                onClick={() => setAllocOpen(true)}
                style={{ borderRadius: 6, height: 40, fontWeight: 500 }}
              >
                Allocate Hostel
              </Button>
            </Tooltip>
          </div>
        </div>

        <StudentList refreshTrigger={refreshTrigger} />
      </div>

      {/* Allocate Hostel Modal */}
      <Modal
        title="Allocate Hostel"
        open={allocOpen}
        onCancel={() => setAllocOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Typography.Paragraph style={{ marginTop: 0 }}>
          Upload a CSV with columns <b>Roll Number</b> and <b>Hostel</b>. Hostel
          names must match existing hostel names.
        </Typography.Paragraph>
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />}>Select CSV</Button>
        </Upload>
        <div style={{ marginTop: 16 }}>
          <Button
            type="primary"
            onClick={handleAllocUpload}
            loading={uploading}
            disabled={fileList.length === 0}
          >
            {uploading ? "Uploading..." : "Upload and Process"}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Students;
