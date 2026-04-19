import React, { useState, useEffect } from "react";
import { getMessWorkers, createMessWorker, deleteMessWorker, updateMessWorker } from "../../apis/messApi";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { X } from "lucide-react";

const designations = ["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"];

const MessWorkersTab = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerDesignation, setNewWorkerDesignation] = useState(designations[0]);
  const [newWorkerRate, setNewWorkerRate] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState(null);
  const [editWorkerName, setEditWorkerName] = useState("");
  const [editWorkerDesignation, setEditWorkerDesignation] = useState(designations[0]);
  const [editWorkerRate, setEditWorkerRate] = useState("");

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const data = await getMessWorkers();
      setWorkers(data);
    } catch (err) {
      setError("Failed to fetch mess workers: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const handleAddWorker = async () => {
    if (!newWorkerName.trim() || !newWorkerRate) {
      alert("Please enter a name and daily wage rate.");
      return;
    }
    
    try {
      setLoading(true);
      await createMessWorker({
        name: newWorkerName.trim(),
        designation: newWorkerDesignation,
        rate: Number(newWorkerRate)
      });
      await fetchWorkers();
      closeForm();
    } catch (err) {
      alert("Failed to add worker: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorker = async (id) => {
    if (!window.confirm("Are you sure you want to remove this mess worker?")) return;
    try {
      setLoading(true);
      await deleteMessWorker(id);
      await fetchWorkers();
    } catch (err) {
      alert("Failed to delete worker: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setNewWorkerName("");
    setNewWorkerDesignation(designations[0]);
    setNewWorkerRate("");
  };

  const openEdit = (worker) => {
    setEditingWorkerId(worker._id);
    setEditWorkerName(worker.name || "");
    setEditWorkerDesignation(worker.designation || designations[0]);
    setEditWorkerRate(String(worker.rate ?? ""));
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditingWorkerId(null);
    setEditWorkerName("");
    setEditWorkerDesignation(designations[0]);
    setEditWorkerRate("");
  };

  const handleUpdateWorker = async () => {
    if (!editingWorkerId) return;
    if (!editWorkerName.trim() || editWorkerRate === "") {
      alert("Please enter a name and daily wage rate.");
      return;
    }
    try {
      setLoading(true);
      await updateMessWorker(editingWorkerId, {
        name: editWorkerName.trim(),
        designation: editWorkerDesignation,
        rate: Number(editWorkerRate),
      });
      await fetchWorkers();
      closeEdit();
    } catch (err) {
      alert("Failed to update worker: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Mess Workers</h2>
          <Button onClick={() => setFormOpen(true)} disabled={loading}>
            Add Worker
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {formOpen && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Add New Worker</h3>
              <button
                onClick={closeForm}
                className="p-2 rounded-md hover:bg-gray-100"
                title="Close"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="w-full md:w-1/3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  placeholder="Worker name"
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                />
              </div>

              <div className="w-full md:w-1/4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  value={newWorkerDesignation}
                  onChange={(e) => setNewWorkerDesignation(e.target.value)}
                >
                  {designations.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="w-full md:w-1/4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Daily Rate (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  placeholder="e.g. 760"
                  value={newWorkerRate}
                  onChange={(e) => setNewWorkerRate(e.target.value)}
                />
              </div>

              <div className="w-full md:w-auto flex items-center md:justify-end gap-2">
                <Button onClick={handleAddWorker} disabled={loading} className="w-full md:w-auto">
                  Save
                </Button>
                <Button variant="outline" onClick={closeForm} disabled={loading} className="w-full md:w-auto">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {editOpen && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Edit Worker</h3>
              <button
                onClick={closeEdit}
                className="p-2 rounded-md hover:bg-gray-100"
                title="Close"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="w-full md:w-1/3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  placeholder="Worker name"
                  value={editWorkerName}
                  onChange={(e) => setEditWorkerName(e.target.value)}
                />
              </div>

              <div className="w-full md:w-1/4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  value={editWorkerDesignation}
                  onChange={(e) => setEditWorkerDesignation(e.target.value)}
                >
                  {designations.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="w-full md:w-1/4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Daily Rate (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  placeholder="e.g. 760"
                  value={editWorkerRate}
                  onChange={(e) => setEditWorkerRate(e.target.value)}
                />
              </div>

              <div className="w-full md:w-auto flex items-center md:justify-end gap-2">
                <Button onClick={handleUpdateWorker} disabled={loading} className="w-full md:w-auto">
                  Save
                </Button>
                <Button variant="outline" onClick={closeEdit} disabled={loading} className="w-full md:w-auto">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading && workers.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : workers.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No mess workers configured. Click "Add Worker" to hire someone.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">Name</th>
                  <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">Designation</th>
                  <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">Daily Wage</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker._id}>
                    <td className="border border-gray-300 px-4 py-2 text-gray-900">{worker.name}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                        {worker.designation}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-900">₹{worker.rate} / day</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(worker)}
                          disabled={loading}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteWorker(worker._id)}
                          disabled={loading}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
};

export default MessWorkersTab;
