import { useState } from "react";
import { Table, Typography, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";

const { Text } = Typography;

export default function FeedbackList({
  feedbacks = [],
  pageSize,
  page,
  serverTotal,
  onPageChange,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFeedbacks = feedbacks.filter((fb) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name =
      typeof fb === "string"
        ? "Anonymous User"
        : fb?.user?.name || fb?.userName || "Anonymous User";
    const message = typeof fb === "string" ? fb : fb?.message || fb?.text || "";
    return (
      name.toLowerCase().includes(query) ||
      message.toLowerCase().includes(query)
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
          typeof fb !== "string" && fb?.createdAt ? fb.createdAt : null;
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
      title: "Feedback Message",
      key: "message",
      render: (_, fb) => {
        const msg =
          typeof fb === "string"
            ? fb
            : fb?.message || fb?.text || "(No message provided)";
        return (
          <div style={{ whiteSpace: "pre-line", wordBreak: "break-word" }}>
            {msg}
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
          justifyContent: "flex-end",
        }}
      >
        <Input
          placeholder="Search feedbacks..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 300 }}
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
