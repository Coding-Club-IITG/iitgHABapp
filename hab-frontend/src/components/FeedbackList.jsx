import { useState } from "react";
import { Table, Typography, Input, Checkbox, Space, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";

const { Text } = Typography;

const ratingColor = (rating) => {
  switch (rating) {
    case "Very Good":
      return "success";
    case "Good":
      return "processing";
    case "Average":
      return "warning";
    case "Poor":
      return "error";
    case "Very Poor":
      return "error";
    default:
      return "default";
  }
};
export default function FeedbackList({
  feedbacks = [],
  pageSize,
  page,
  serverTotal,
  onPageChange,
  showOnlySMC,
  onOnlySMCChange,
  hideEmptyMessages,
  onHideEmptyMessagesChange,
  hideRatings,
  onHideRatingsChange,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFeedbacks = feedbacks.filter((fb) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name =
      typeof fb === "string"
        ? "Anonymous User"
        : fb?.user?.name || fb?.userName || "Anonymous User";
    const msg =
      typeof fb === "string"
        ? fb
        : fb?.message || fb?.text || fb?.comment || "";

    return (
      name.toLowerCase().includes(query) || msg.toLowerCase().includes(query)
    );
  });

  const columns = [
    {
      title: "User",
      key: "user",
      width: "25%",
      render: (_, fb) => (
        <Text strong>
          {typeof fb === "string"
            ? "Anonymous User"
            : fb?.user?.name || fb?.userName || "Anonymous User"}
        </Text>
      ),
    },
    {
      title: "Date",
      key: "date",
      width: "20%",
      render: (_, fb) => {
        const dateStr =
          typeof fb !== "string" ? fb?.createdAt || fb?.date : null;
        return dateStr ? (
          <Text type="secondary">
            {new Date(dateStr).toLocaleString("en-IN", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
    {
      title: "Feedback",
      key: "message",
      render: (_, fb) => {
        const msg =
          typeof fb === "string"
            ? fb
            : fb?.message || fb?.text || fb?.comment || "(No message provided)";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ whiteSpace: "pre-line", wordBreak: "break-word" }}>
              {msg}
            </div>
            {!hideRatings &&
              typeof fb !== "string" &&
              (fb.breakfast || fb.lunch || fb.dinner || fb.smcFields) && (
                <Space size={[12, 4]} wrap style={{ fontSize: "12px" }}>
                  {fb.breakfast && (
                    <span>
                      <Text type="secondary">Breakfast:</Text>{" "}
                      <Tag
                        color={ratingColor(fb.breakfast)}
                        style={{ marginLeft: 4 }}
                      >
                        {fb.breakfast}
                      </Tag>
                    </span>
                  )}
                  {fb.lunch && (
                    <span>
                      <Text type="secondary">Lunch:</Text>{" "}
                      <Tag
                        color={ratingColor(fb.lunch)}
                        style={{ marginLeft: 4 }}
                      >
                        {fb.lunch}
                      </Tag>
                    </span>
                  )}
                  {fb.dinner && (
                    <span>
                      <Text type="secondary">Dinner:</Text>{" "}
                      <Tag
                        color={ratingColor(fb.dinner)}
                        style={{ marginLeft: 4 }}
                      >
                        {fb.dinner}
                      </Tag>
                    </span>
                  )}
                  {fb.smcFields && (
                    <>
                      <span>
                        <Text type="secondary">Hygiene:</Text>{" "}
                        <Tag
                          color={ratingColor(fb.smcFields.hygiene)}
                          style={{ marginLeft: 4 }}
                        >
                          {fb.smcFields.hygiene}
                        </Tag>
                      </span>
                      <span>
                        <Text type="secondary">Quality:</Text>{" "}
                        <Tag
                          color={ratingColor(fb.smcFields.qualityOfIngredients)}
                          style={{ marginLeft: 4 }}
                        >
                          {fb.smcFields.qualityOfIngredients}
                        </Tag>
                      </span>
                      <span>
                        <Text type="secondary">Uniform:</Text>{" "}
                        <Tag
                          color={ratingColor(
                            fb.smcFields.uniformAndPunctuality,
                          )}
                          style={{ marginLeft: 4 }}
                        >
                          {fb.smcFields.uniformAndPunctuality}
                        </Tag>
                      </span>
                      <span>
                        <Text type="secondary">Waste:</Text>{" "}
                        <Tag
                          color={ratingColor(fb.smcFields.wasteDisposal)}
                          style={{ marginLeft: 4 }}
                        >
                          {fb.smcFields.wasteDisposal}
                        </Tag>
                      </span>
                    </>
                  )}
                </Space>
              )}
          </div>
        );
      },
    },
  ];

  const paginationConfig = onPageChange
    ? {
        current: page || 1,
        pageSize: pageSize || 10,
        total: serverTotal || filteredFeedbacks.length,
        onChange: (p) => onPageChange(p),
        showSizeChanger: false,
        showTotal: (total) => `Total ${total} feedbacks`,
      }
    : {
        pageSize: pageSize || 10,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} feedbacks`,
      };

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 8,
        padding: 16,
        border: "1px solid #f0f0f0",
      }}
    >
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Space wrap>
          <Checkbox
            checked={hideEmptyMessages}
            onChange={(e) => onHideEmptyMessagesChange(e.target.checked)}
          >
            Hide Empty Messages
          </Checkbox>
          <Checkbox
            checked={showOnlySMC}
            onChange={(e) => onOnlySMCChange(e.target.checked)}
          >
            Only Show SMC Users
          </Checkbox>
          <Checkbox
            checked={hideRatings}
            onChange={(e) => onHideRatingsChange(e.target.checked)}
          >
            Hide Ratings
          </Checkbox>
        </Space>
        <Input
          placeholder="Search feedbacks..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 250 }}
          allowClear
        />
      </div>
      <Table
        columns={columns}
        dataSource={filteredFeedbacks}
        rowKey={(record, index) =>
          typeof record === "string" ? index : record.id || record._id || index
        }
        pagination={paginationConfig}
        size="middle"
      />
    </div>
  );
}
