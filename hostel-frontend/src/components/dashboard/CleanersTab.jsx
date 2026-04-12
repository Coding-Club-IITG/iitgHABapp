import React, { useState, useEffect } from "react";
import {
  getCleaners as apiGetCleaners,
  createCleaner as apiCreateCleaner,
  updateCleaner as apiUpdateCleaner,
  deleteCleaner as apiDeleteCleaner,
  getBookingsForDate as apiGetBookingsForDate,
} from "../../apis/roomCleaningApi";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { Pencil, X } from "lucide-react";

const CleanersTab = () => {
  const [cleaners, setCleaners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [newCleanerName, setNewCleanerName] = useState("");
  const [newCleanerSlots, setNewCleanerSlots] = useState([]);
  const [cleanerFormOpen, setCleanerFormOpen] = useState(false);
  const [editingCleanerId, setEditingCleanerId] = useState(null);
  const [selectedCleanerId, setSelectedCleanerId] = useState("");

  const [bookingsDate, setBookingsDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [rcBookings, setRcBookings] = useState([]);
  const [rcBookingsLoading, setRcBookingsLoading] = useState(false);
  const [rcBookingsError, setRcBookingsError] = useState("");

  const fetchCleaners = async () => {
    try {
      setLoading(true);
      const data = await apiGetCleaners();
      setCleaners(data);
    } catch (err) {
      setError("Failed to fetch room cleaners: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingsForDate = async (dateStr) => {
    try {
      setRcBookingsError("");
      setRcBookingsLoading(true);
      const data = await apiGetBookingsForDate(dateStr);
      setRcBookings(data);
    } catch (err) {
      setRcBookingsError(
        "Failed to fetch room-cleaning bookings: " + (err.response?.data?.message || err.message)
      );
      setRcBookings([]);
    } finally {
      setRcBookingsLoading(false);
    }
  };

  useEffect(() => {
    fetchCleaners();
  }, []);

  useEffect(() => {
    if (cleaners.length > 0 && !selectedCleanerId) {
      setSelectedCleanerId(cleaners[0]._id);
    }
  }, [cleaners, selectedCleanerId]);

  useEffect(() => {
    fetchBookingsForDate(bookingsDate);
  }, [bookingsDate]);

  const handleSubmitCleaner = async () => {
    if (!newCleanerName.trim() || newCleanerSlots.length === 0) {
      alert("Please enter a name and select at least one slot.");
      return;
    }
    try {
      setLoading(true);
      if (editingCleanerId) {
        await apiUpdateCleaner(editingCleanerId, newCleanerName.trim(), newCleanerSlots);
      } else {
        await apiCreateCleaner(newCleanerName.trim(), newCleanerSlots);
      }
      await fetchCleaners();
      closeCleanerForm();
    } catch (err) {
      alert(
        `Failed to ${editingCleanerId ? "update" : "create"} cleaner: ` +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleNewCleanerSlot = (slot) => {
    setNewCleanerSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  const openAddCleanerForm = () => {
    setEditingCleanerId(null);
    setNewCleanerName("");
    setNewCleanerSlots([]);
    setCleanerFormOpen(true);
  };

  const openEditCleanerForm = (cleaner) => {
    setEditingCleanerId(cleaner?._id || null);
    setNewCleanerName(cleaner?.name || "");
    setNewCleanerSlots(Array.isArray(cleaner?.slots) ? cleaner.slots : []);
    setCleanerFormOpen(true);
  };

  const closeCleanerForm = () => {
    setCleanerFormOpen(false);
    setEditingCleanerId(null);
    setNewCleanerName("");
    setNewCleanerSlots([]);
  };

  const handleDeleteCleaner = async (id) => {
    if (!window.confirm("Delete this cleaner? Existing bookings remain.")) {
      return;
    }
    try {
      setLoading(true);
      await apiDeleteCleaner(id);
      await fetchCleaners();
    } catch (err) {
      alert("Failed to delete cleaner: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const selectedCleaner = cleaners.find((c) => c._id === selectedCleanerId) || null;

  const dateOptions = (() => {
    const opts = [];
    const base = new Date();
    for (let i = -2; i <= 5; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const value = `${yyyy}-${mm}-${dd}`;
      const label = i === 0 ? `Today (${value})` : i === 1 ? `Tomorrow (${value})` : value;
      opts.push({ value, label });
    }
    if (!opts.some((o) => o.value === bookingsDate)) {
      opts.unshift({ value: bookingsDate, label: bookingsDate });
    }
    return opts;
  })();

  const bookingsForCleaner = selectedCleanerId
    ? rcBookings.filter((b) => String(b.assignedTo || "") === selectedCleanerId)
    : [];

  return (
    <Card>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Room Cleaners</h2>
          <Button onClick={openAddCleanerForm} disabled={loading}>
            Add Cleaner
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {cleanerFormOpen && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                {editingCleanerId ? "Edit Cleaner" : "Add New Cleaner"}
              </h3>
              <button
                onClick={closeCleanerForm}
                className="p-2 rounded-md hover:bg-gray-100"
                title="Close"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="w-full md:flex-1 min-w-[220px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Cleaner name
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  placeholder="Cleaner name"
                  value={newCleanerName}
                  onChange={(e) => setNewCleanerName(e.target.value)}
                />
              </div>

              <div className="w-full md:flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Slots</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {["A", "B", "C", "D"].map((slot) => (
                    <label key={slot} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={newCleanerSlots.includes(slot)}
                        onChange={() => toggleNewCleanerSlot(slot)}
                      />
                      <span>Slot {slot}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="w-full md:w-auto flex items-center md:justify-end gap-2">
                <Button
                  onClick={handleSubmitCleaner}
                  disabled={loading}
                  className="w-full md:w-auto"
                >
                  {editingCleanerId ? "Save Cleaner" : "Create Cleaner"}
                </Button>
                <Button
                  variant="outline"
                  onClick={closeCleanerForm}
                  disabled={loading}
                  className="w-full md:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading && cleaners.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : cleaners.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No cleaners configured yet. Click “Add Cleaner” to create the first cleaner.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Select cleaner</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  value={selectedCleanerId}
                  onChange={(e) => setSelectedCleanerId(e.target.value)}
                >
                  {cleaners.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedCleaner && (
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-800">{selectedCleaner.name}</div>
                    <div className="text-xs text-gray-600">
                      Slots:{" "}
                      {Array.isArray(selectedCleaner.slots) && selectedCleaner.slots.length > 0
                        ? selectedCleaner.slots.slice().sort().join(", ")
                        : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditCleanerForm(selectedCleaner)}
                      disabled={loading}
                      className="gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteCleaner(selectedCleaner._id)}
                      disabled={loading}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-800">Assigned bookings</div>
                  <div className="text-xs text-gray-600">
                    Shows bookings assigned to the selected cleaner for the chosen date.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600">Date</label>
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                    value={bookingsDate}
                    onChange={(e) => setBookingsDate(e.target.value)}
                  >
                    {dateOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {rcBookingsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
                </div>
              ) : rcBookingsError ? (
                <p className="text-sm text-red-600">{rcBookingsError}</p>
              ) : !selectedCleanerId ? (
                <p className="text-sm text-gray-600">Select a cleaner to view bookings.</p>
              ) : bookingsForCleaner.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No bookings assigned to this cleaner for {bookingsDate}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-200 px-3 py-2 text-left">Room</th>
                        <th className="border border-gray-200 px-3 py-2 text-left">Slot</th>
                        <th className="border border-gray-200 px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookingsForCleaner.map((b) => (
                        <tr key={b._id}>
                          <td className="border border-gray-200 px-3 py-2">{b.roomNumber || "—"}</td>
                          <td className="border border-gray-200 px-3 py-2">
                            {b.timeRange || `Slot ${b.slot || "—"}`}
                          </td>
                          <td className="border border-gray-200 px-3 py-2">{b.status || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default CleanersTab;
