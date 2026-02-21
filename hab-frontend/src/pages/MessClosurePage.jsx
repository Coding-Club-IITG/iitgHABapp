// HAB Admin: Schedule / View / Edit / Delete mess closures
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import {
  getAllMessClosures,
  createMessClosure,
  updateMessClosure,
  deleteMessClosure,
} from "../apis/messClosures";
import { getAllHostels } from "../apis/hostel"; // fetches list of all hostels for dropdown

// ── Small reusable toast ──────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors =
    type === "error"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-green-50 border-green-200 text-green-700";

  return (
    <div
      className={`fixed top-6 right-6 z-50 flex items-start gap-3 px-4 py-3 rounded-lg border shadow-md max-w-sm ${colors}`}
    >
      <span className="flex-1 text-sm">{message}</span>
      <button onClick={onClose} className="text-lg leading-none opacity-60 hover:opacity-100">
        ×
      </button>
    </div>
  );
};

// ── Modal shell ───────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ×
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  </div>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Returns true if a closure can still be edited/deleted (within 8 hours of creation) */
const isEditable = (createdAt) => {
  if (!createdAt) return false;
  const diffMs = Date.now() - new Date(createdAt).getTime();
  return diffMs < 8 * 60 * 60 * 1000; // 8 hours in ms
};

/** Returns minimum date string (today + 48 h) for the date input */
const minClosureDate = () => {
  const d = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
};

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ── Main component ────────────────────────────────────────────────────────────
const MessClosurePage = () => {
  // ── Data state ──
  const [closures, setClosures] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Filter state ──
  const [filterHostel, setFilterHostel] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterUpcoming, setFilterUpcoming] = useState(false);

  // ── Toast state ──
  const [toast, setToast] = useState(null); // { message, type }

  // ── Modal state ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);   // closure object being edited
  const [deleteTarget, setDeleteTarget] = useState(null); // closure object to confirm delete

  // ── Form state (shared between create & edit) ──
  const emptyForm = { hostelId: "", closureDate: ""};
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // ── Toast helper ──
  const showToast = (message, type = "success") => setToast({ message, type });

  // ── Fetch all closures ──
  const fetchClosures = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        ...(filterHostel && { hostelId: filterHostel }),
        ...(filterMonth && { month: filterMonth }),
        ...(filterYear && { year: filterYear }),
        ...(filterUpcoming && { upcoming: true }),
      };
      const data = await getAllMessClosures(filters);
      setClosures(data.closures || data || []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load closures.", "error");
    } finally {
      setLoading(false);
    }
  }, [filterHostel, filterMonth, filterYear, filterUpcoming]);

//     const fetchClosures = useCallback(async () => {
//   setLoading(true);
//   // TEMP MOCK DATA - remove this and uncomment the real code when backend is ready
//   setClosures([
//     {
//       _id: "1",
//       hostelId: { hostel_name: "Brahmaputra" },
//       closureDate: "2026-03-15T00:00:00.000Z",
//       month: 3,
//       year: 2026,
//       createdAt: new Date().toISOString(), // recent = edit/delete buttons should be active
//     },
//     {
//       _id: "2",
//       hostelId: { hostel_name: "Lohit" },
//       closureDate: "2026-02-10T00:00:00.000Z",
//       month: 2,
//       year: 2026,
//       createdAt: "2026-02-01T00:00:00.000Z", // old = edit/delete should be locked
//     },
//   ]);
//   setLoading(false);
// }, [filterHostel, filterMonth, filterYear, filterUpcoming]);

  // ── Fetch hostel list for dropdown ──
  
  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  useEffect(() => {
    fetchClosures();
  }, [fetchClosures]);

  // ── Open create modal ──
  const openCreate = () => {
    setForm(emptyForm);
    setShowCreateModal(true);
  };

  // ── Open edit modal ──
  const openEdit = (closure) => {
    if (!isEditable(closure.createdAt)) {
      showToast(
        "This closure cannot be edited — more than 8 hours have passed since it was created.",
        "error"
      );
      return;
    }
    setEditTarget(closure);
    setForm({
      hostelId: closure.hostel?._id || closure.hostelId || "",
      closureDate: closure.closureDate?.split("T")[0] || "",
      reason: closure.reason || "",
    });
  };

  // ── Validate form ──
  const validateForm = () => {
  if (!form.hostelId) return "Please select a hostel.";
  if (!form.closureDate) return "Please pick a closure date.";
  const selectedDate = new Date(form.closureDate);
  const minDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
  if (selectedDate < minDate) {
    return "Closure must be scheduled at least 48 hours in advance.";
  }
  return null;
};
  // ── Submit create ──
  const handleCreate = async (e) => {
   
    const err = validateForm();
    if (err) { showToast(err, "error"); return; }
    setSubmitting(true);
    try {
      await createMessClosure({
        hostelId: form.hostelId,
        closureDate: form.closureDate,
      });
      showToast("Mess closure scheduled successfully.");
      setShowCreateModal(false);
      setForm(emptyForm);
      fetchClosures();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to schedule closure.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit edit ──
  const handleEdit = async (e) => {
    e.preventDefault();
    
    const validErr = validateForm();
    if (validErr) { showToast(validErr, "error"); return; }
    setSubmitting(true);
    try {
      await updateMessClosure(editTarget._id, {
        closureDate: form.closureDate,
      });
      showToast("Closure updated successfully.");
      setEditTarget(null);
      setForm(emptyForm);
      fetchClosures();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update closure.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Confirm delete ──
  const handleDelete = async () => {
        
    if (!deleteTarget) return;
    if (!isEditable(deleteTarget.createdAt)) {
      showToast(
        "This closure cannot be deleted — more than 8 hours have passed since it was created.",
        "error"
      );
      setDeleteTarget(null);
      return;
    }
    setSubmitting(true);
    try {
      await deleteMessClosure(deleteTarget._id);
      showToast("Closure deleted.");
      setDeleteTarget(null);
      fetchClosures();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete closure.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Shared form body (used in both create & edit modal) ──
  const FormBody = ({ isEdit }) => (
    <form onSubmit={isEdit ? handleEdit : handleCreate} className="space-y-4">
      {/* Hostel dropdown — only in create; in edit it's fixed */}
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hostel <span className="text-red-500">*</span>
          </label>
          <select
            value={form.hostelId}
            onChange={(e) => setForm((f) => ({ ...f, hostelId: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Select Hostel —</option>
            {hostels.map((h) => (
              <option key={h._id} value={h._id}>
                {h.hostel_name || h.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Closure Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Closure Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          min={minClosureDate()}
          value={form.closureDate}
          onChange={(e) => setForm((f) => ({ ...f, closureDate: e.target.value }))}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">Must be at least 48 hours from now.</p>
      </div>

      {/* Reason
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={3}
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          placeholder="e.g. Maintenance / Holiday / Public event"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div> */}

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            isEdit ? setEditTarget(null) : setShowCreateModal(false);
            setForm(emptyForm);
          }}
          className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEdit ? "Save Changes" : "Schedule Closure"}
        </button>
      </div>
    </form>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <Modal title="Schedule Mess Closure" onClose={() => setShowCreateModal(false)}>
          <FormBody isEdit={false} />
        </Modal>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <Modal
        title={`Edit Closure — ${editTarget.hostelId?.hostel_name || ""}`}
          onClose={() => { setEditTarget(null); setForm(emptyForm); }}
        >
          <FormBody isEdit={true} />
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal title="Delete Closure" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-gray-600 mb-6">
            Are you sure you want to delete the closure for{" "}
            <span className="font-semibold">
            {deleteTarget.hostelId?.hostel_name || "this hostel"}    
            </span>{" "}
            on <span className="font-semibold">{formatDate(deleteTarget.closureDate)}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mess Closures</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage scheduled mess closure days across all hostels.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Schedule Closure
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Hostel filter */}
          <select
            value={filterHostel}
            onChange={(e) => setFilterHostel(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Hostels</option>
            {hostels.map((h) => (
              <option key={h._id} value={h._id}>
                {h.hostel_name || h.name}
              </option>
            ))}
          </select>

          {/* Month filter */}
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Months</option>
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>

          {/* Year filter */}
          <input
            type="number"
            placeholder="Year (e.g. 2025)"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Upcoming toggle + Reset */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterUpcoming}
                onChange={(e) => setFilterUpcoming(e.target.checked)}
                className="accent-blue-600"
              />
              Upcoming only
            </label>
            <button
              onClick={() => {
                setFilterHostel("");
                setFilterMonth("");
                setFilterYear("");
                setFilterUpcoming(false);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : closures.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No mess closures found. Use the filters above or schedule a new one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Hostel</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Closure Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Month</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                 
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {closures.map((c) => {
                  const editable = isEditable(c.createdAt);
                  const closureDate = new Date(c.closureDate);
                  const isPast = closureDate < new Date();

                  return (
                    <tr key={c._id} className={isPast ? "bg-gray-50 text-gray-400" : ""}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                    {c.hostelId?.hostel_name || "—"}
                      </td>
                      <td className="px-4 py-3">{formatDate(c.closureDate)}</td>
                      <td className="px-4 py-3">
                        {MONTHS[closureDate.getMonth()]} {closureDate.getFullYear()}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={c.reason}>
                        {c.reason || "—"}
                      </td>
                     
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(c)}
                            disabled={!editable}
                            title={
                              !editable
                                ? "Can only edit within 8 hours of creation"
                                : "Edit closure"
                            }
                            className={`px-3 py-1 rounded text-xs border transition-colors ${
                              editable
                                ? "border-blue-200 text-blue-600 hover:bg-blue-50"
                                : "border-gray-200 text-gray-300 cursor-not-allowed"
                            }`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => editable && setDeleteTarget(c)}
                            disabled={!editable}
                            title={
                              !editable
                                ? "Can only delete within 8 hours of creation"
                                : "Delete closure"
                            }
                            className={`px-3 py-1 rounded text-xs border transition-colors ${
                              editable
                                ? "border-red-200 text-red-600 hover:bg-red-50"
                                : "border-gray-200 text-gray-300 cursor-not-allowed"
                            }`}
                          >
                            Delete
                          </button>
                        </div>
                        {!editable && !isPast && (
                          <p className="text-xs text-gray-400 mt-1">Locked (8h passed)</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessClosurePage;