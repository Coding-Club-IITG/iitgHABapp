import React from "react";

// FeedbackList: simple feedback table
// props:
// - feedbacks: Array<{ user?: { name?: string }, userName?: string, createdAt?: string|number, message?: string, text?: string }>
export default function FeedbackList({ feedbacks = [] }) {
  if (!feedbacks || feedbacks.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-8 text-center border border-gray-300 rounded bg-white">
        No feedback messages available.
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded overflow-hidden bg-white">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 w-1/5">
              User
            </th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 w-1/6">
              Date
            </th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
              Feedback Message
            </th>
          </tr>
        </thead>
        <tbody>
          {feedbacks.map((fb, idx) => (
            <tr
              key={
                typeof fb === "string"
                  ? `${idx}-${fb}`
                  : fb?._id ||
                    `${fb?.createdAt || "na"}-${fb?.user?._id || fb?.userName || idx}`
              }
              className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3 text-sm text-gray-800">
                {typeof fb === "string"
                  ? "Anonymous User"
                  : fb?.user?.name || fb?.userName || "Anonymous User"}
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {typeof fb !== "string" && fb?.createdAt
                  ? new Date(fb.createdAt).toLocaleString("en-IN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                <div className="whitespace-pre-line">
                  {typeof fb === "string"
                    ? fb
                    : fb?.message || fb?.text || "(No message provided)"}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
