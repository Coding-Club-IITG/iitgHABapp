import React, { useEffect, useMemo, useState } from "react";
import { getAllocations, getAllHostels, updateAllocation, upsertAllocation } from "../apis/hostel";

const HostelAllocations = () => {
  const [allocations, setAllocations] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editEmail, setEditEmail] = useState("");
  const [updating, setUpdating] = useState(false);

  const [hostels, setHostels] = useState([]);
  const [entryRoll, setEntryRoll] = useState("");
  const [entryHostelId, setEntryHostelId] = useState("");
  const [entryCurrentMessId, setEntryCurrentMessId] = useState("");
  const [entryEmail, setEntryEmail] = useState("");
  const [entrySaving, setEntrySaving] = useState(false);

  const hostelOptions = useMemo(
    () =>
      (hostels || [])
        .map((h) => ({
          id: String(h._id),
          name: h.hostel_name || String(h._id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [hostels],
  );

  const fetchAllocations = async (currentPage = 1, searchQuery = "") => {
    setLoading(true);
    try {
      const data = await getAllocations(currentPage, searchQuery);
      setAllocations(data?.allocations || []);
      setTotalPages(data?.totalPages || 1);
      setPage(data?.currentPage || 1);
    } catch (err) {
      console.error("Error fetching allocations:", err);
      // fallback so we don't crash
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load hostels for dropdowns (best-effort).
    (async () => {
      try {
        const data = await getAllHostels();
        const list = data?.hostels || data || [];
        if (Array.isArray(list)) setHostels(list);
      } catch (_) {
        setHostels([]);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAllocations(1, search);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchAllocations(1, search);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchAllocations(newPage, search);
    }
  };

  const handleEdit = (alloc) => {
    setEditId(alloc._id);
    setEditEmail(alloc.email || "");
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditEmail("");
  };

  const handleSaveEdit = async (id) => {
    setUpdating(true);
    try {
      await updateAllocation(id, editEmail);
      setAllocations((prev) =>
        prev.map((a) => (a._id === id ? { ...a, email: editEmail } : a))
      );
      setEditId(null);
    } catch (err) {
      console.error("Error updating allocation:", err);
      alert(err.response?.data?.message || "Failed to update allocation");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpsert = async (e) => {
    e.preventDefault();
    const roll = entryRoll.trim();
    if (!roll || !entryHostelId) {
      alert("Roll number and hostel are required");
      return;
    }
    setEntrySaving(true);
    try {
      await upsertAllocation({
        rollno: roll,
        hostelId: entryHostelId,
        currentSubscribedMessId: entryCurrentMessId || undefined,
        email: entryEmail.trim() || undefined,
      });
      setEntryRoll("");
      setEntryHostelId("");
      setEntryCurrentMessId("");
      setEntryEmail("");
      // Refresh current list
      fetchAllocations(1, search);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save allocation");
    } finally {
      setEntrySaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex flex-col h-full min-h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hostel Allocations</h1>
          <p className="text-gray-500 mt-1">Manage student hostel allocations and email mappings</p>
        </div>
        
        <form onSubmit={handleSearch} className="flex max-w-md w-full">
          <input
            type="text"
            placeholder="Search by Roll Number..."
            className="flex-1 rounded-l-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700"
          >
            Search
          </button>
        </form>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50">
        <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">
              Add / Update a single allocation
            </h2>
            <p className="text-xs text-gray-600">
              Email and current subscribed mess are optional. If current subscribed mess is left empty, it will default to the selected hostel.
            </p>
          </div>
        </div>

        <form onSubmit={handleUpsert} className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            value={entryRoll}
            onChange={(e) => setEntryRoll(e.target.value)}
            placeholder="Roll number"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={entryHostelId}
            onChange={(e) => setEntryHostelId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select hostel</option>
            {hostelOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <select
            value={entryCurrentMessId}
            onChange={(e) => setEntryCurrentMessId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Subscribed mess (optional)</option>
            {hostelOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <input
            value={entryEmail}
            onChange={(e) => setEntryEmail(e.target.value)}
            placeholder="Email (optional)"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={entrySaving}
            className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {entrySaving ? "Saving..." : "Save"}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hostel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscribed Mess</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">Loading...</td>
              </tr>
            ) : !allocations || allocations.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No allocations found.</td>
              </tr>
            ) : (
              allocations.map((alloc) => (
                <tr key={alloc._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {alloc?.rollno || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {alloc?.hostel?.hostel_name || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {alloc?.current_subscribed_mess?.hostel_name || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editId === alloc._id ? (
                      <input
                        type="email"
                        className="border border-gray-300 rounded px-2 py-1 w-full"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        disabled={updating}
                      />
                    ) : (
                      alloc?.email || <span className="text-gray-400 italic">Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editId === alloc._id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSaveEdit(alloc._id)}
                          disabled={updating}
                          className="text-green-600 hover:text-green-900"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={updating}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(alloc)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">
            Page <span className="font-medium text-gray-900">{page}</span> of <span className="font-medium text-gray-900">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages || loading}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostelAllocations;