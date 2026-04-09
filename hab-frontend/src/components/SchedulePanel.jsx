import { Card, Space, Typography, Divider } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

const SchedulePanel = ({
  scheduleInfo,
  loading,
  title = "Automatic Schedule",
}) => {
  return (
    <Card
      title={
        <>
          <ClockCircleOutlined style={{ color: "#1890ff", marginRight: 8 }} />{" "}
          {title}
        </>
      }
      style={{
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        height: "100%",
      }}
      loading={loading}
    >
      {scheduleInfo ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <Text strong style={{ display: "block", color: "#1890ff" }}>
              Auto Enable
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {scheduleInfo.schedule.enablePattern}
            </Text>
            <br />
            <Text style={{ fontSize: 13 }}>
              Next: {scheduleInfo.schedule.nextEnableDateIST}
            </Text>
          </div>
          <Divider style={{ margin: "12px 0" }} />
          <div>
            <Text strong style={{ display: "block", color: "#cf1322" }}>
              Auto Disable
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {scheduleInfo.schedule.disablePattern}
            </Text>
            <br />
            <Text style={{ fontSize: 13 }}>
              Next: {scheduleInfo.schedule.nextDisableDateIST}
            </Text>
          </div>
        </Space>
      ) : (
        <Text type="secondary">Unable to load schedule info</Text>
      )}
    </Card>
  );
};

export default SchedulePanel;
