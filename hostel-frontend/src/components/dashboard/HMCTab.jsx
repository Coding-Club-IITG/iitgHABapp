import React, { useState, useEffect } from "react";
import axios from "axios";
import { Select } from "antd";
import { API_BASE_URL } from "../../apis";
import { getBoarders as apiGetBoarders } from "../../apis/hostelApi";
import Card from "../ui/Card";
import Button from "../ui/Button";

const HMC_TYPES = [
  "General Secretary",
  "Associate General Secretary",
  "Literary Secretary",
  "Cultural Secretary",
  "Technical Secretary",
  "Sports Secretary",
  "Welfare Secretary",
  "Maintenance Secretary",
  "Service Secretary",
];

const HMCTab = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [boarders, setBoarders] = useState([]);

  const [hmcMembers, setHmcMembers] = useState([]);
  const [pendingHmcMembers, setPendingHmcMembers] = useState([]);
  const [hmcSearch, setHmcSearch] = useState("");
  const [hmcSelectedType, setHmcSelectedType] = useState("");
  const [hmcSelectedUser, setHmcSelectedUser] = useState("");
  const [hmcSaving, setHmcSaving] = useState(false);

  const fetchBoarders = async () => {
    try {
      const data = await apiGetBoarders();
      setBoarders(data);
    } catch (err) {
      setError("Failed to fetch boarders: " + err.message);
    }
  };

  const fetchHMCMembers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/hostel/hmc-members`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const members = response.data.hmcMembers || [];
      setHmcMembers(members);
      setPendingHmcMembers(
        members.map((m) => ({
          type: m.type,
          user: m.user._id,
          userData: m.user,
        }))
      );
    } catch (err) {
      setError(
        "Failed to fetch HMC members: " + (err.response?.data?.message || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoarders();
    fetchHMCMembers();
  }, []);

  const saveHMCMembers = async () => {
    try {
      setHmcSaving(true);
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Not authenticated. Please login again.");
        return;
      }
      await axios.post(
        `${API_BASE_URL}/hostel/hmc-members`,
        { hmcMembers: pendingHmcMembers },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      await fetchHMCMembers();
      alert("HMC members saved successfully");
    } catch (err) {
      console.error("Error saving HMC members:", err);
      alert(
        "Failed to save HMC members: " +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setHmcSaving(false);
    }
  };

  const addHmcMember = () => {
    if (!hmcSelectedType || !hmcSelectedUser) {
      alert("Please select both a secretary type and a user.");
      return;
    }
    const userData = boarders.find((b) => b._id === hmcSelectedUser);
    if (!userData) {
      alert("Invalid user selected.");
      return;
    }
    const newMember = {
      type: hmcSelectedType,
      user: hmcSelectedUser,
      userData: userData,
    };
    setPendingHmcMembers([...pendingHmcMembers, newMember]);
    setHmcSelectedType("");
    setHmcSelectedUser("");
  };

  const removeHmcMember = (index) => {
    setPendingHmcMembers(pendingHmcMembers.filter((_, i) => i !== index));
  };

  const discardHmcChanges = () => {
    setPendingHmcMembers(
      hmcMembers.map((m) => ({
        type: m.type,
        user: m.user._id,
        userData: m.user,
      }))
    );
  };

  return (
    <Card>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">HMC Management</h2>
          <input
            type="text"
            value={hmcSearch}
            onChange={(e) => setHmcSearch(e.target.value)}
            placeholder="Search by name or roll..."
            className="w-64 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading && boarders.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-lg font-semibold mb-3">Add New HMC Member</h3>
              <div className="flex flex-wrap items-end gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Secretary Type
                  </label>
                  <select
                    value={hmcSelectedType}
                    onChange={(e) => setHmcSelectedType(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select type...</option>
                    {HMC_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Select User (Boarder)
                  </label>
                  <div className="ant-select-wrapper">
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Search by name or roll..."
                      value={hmcSelectedUser || undefined}
                      onChange={(value) => setHmcSelectedUser(value)}
                      className="w-full"
                      options={boarders.map((b) => ({
                        value: b._id,
                        label: `${b.name} (${b.rollNumber})`,
                      }))}
                      filterOption={(input, option) =>
                        option.label.toLowerCase().includes(input.toLowerCase())
                      }
                      popupMatchSelectWidth={false}
                    />
                  </div>
                </div>
                <div>
                  <Button
                    onClick={addHmcMember}
                    className="bg-blue-500 hover:bg-blue-600"
                    disabled={!hmcSelectedType || !hmcSelectedUser}
                  >
                    Add Member
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">
                Current HMC Members ({pendingHmcMembers.length})
              </h3>
              {pendingHmcMembers.length === 0 ? (
                <p className="text-gray-500 text-sm p-4 border border-gray-200 rounded-lg">
                  No HMC members configured yet. Add members using the form above.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-300">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Roll Number</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Room</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Email</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Phone</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Photo</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingHmcMembers
                        .filter((member) => {
                          if (!hmcSearch.trim()) return true;
                          const q = hmcSearch.toLowerCase();
                          return (
                            member.userData?.name?.toLowerCase().includes(q) ||
                            member.userData?.rollNumber?.toLowerCase().includes(q) ||
                            member.type.toLowerCase().includes(q)
                          );
                        })
                        .map((member, index) => (
                        <tr key={`${member.user}-${index}`}>
                          <td className="border border-gray-300 px-4 py-2">{member.type}</td>
                          <td className="border border-gray-300 px-4 py-2">
                            {member.userData?.name || "N/A"}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {member.userData?.rollNumber || "N/A"}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {member.userData?.roomNumber || "N/A"}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {member.userData?.email || "N/A"}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {member.userData?.phoneNumber || "N/A"}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {member.userData?.profilePictureUrl ? (
                              <img
                                src={member.userData.profilePictureUrl}
                                alt={member.userData?.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                                No img
                              </div>
                            )}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            <Button
                              onClick={() => removeHmcMember(index)}
                              className="bg-red-500 hover:bg-red-600 text-sm"
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                {JSON.stringify(pendingHmcMembers) !==
                JSON.stringify(
                  hmcMembers.map((m) => ({
                    type: m.type,
                    user: m.user._id,
                    userData: m.user,
                  }))
                ) ? (
                  <span className="text-amber-600">You have unsaved changes</span>
                ) : (
                  "No unsaved changes"
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={discardHmcChanges}
                  disabled={hmcSaving}
                >
                  Discard Changes
                </Button>
                <Button
                  onClick={saveHMCMembers}
                  disabled={hmcSaving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {hmcSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default HMCTab;
