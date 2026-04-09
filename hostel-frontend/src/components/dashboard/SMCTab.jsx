import React, { useState, useEffect } from "react";
import { 
  getSMCMembers as apiGetSMCMembers, 
  getBoarders as apiGetBoarders, 
  markAsSMC as apiMarkAsSMC, 
  unmarkAsSMC as apiUnmarkAsSMC 
} from "../../apis/hostelApi";
import Card from "../ui/Card";
import Button from "../ui/Button";

const SMCTab = () => {
  const [smcMembers, setSmcMembers] = useState([]);
  const [boarders, setBoarders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [smcSearch, setSmcSearch] = useState("");

  const fetchSMCMembers = async () => {
    try {
      const data = await apiGetSMCMembers();
      setSmcMembers(data);
    } catch (err) {
      setError("Failed to fetch SMC members: " + err.message);
    }
  };

  const fetchBoarders = async () => {
    try {
      const data = await apiGetBoarders();
      setBoarders(data);
    } catch (err) {
      setError("Failed to fetch boarders: " + err.message);
    }
  };

  // Grouped initial load
  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchSMCMembers(), fetchBoarders()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const markAsSMC = async (userId) => {
    try {
      await apiMarkAsSMC(userId);
      await loadData();
    } catch (err) {
      console.error("Error marking as SMC:", err);
      alert("Failed to mark user as SMC: " + (err.response?.data?.message || err.message));
    }
  };

  const unmarkAsSMC = async (userId) => {
    try {
      await apiUnmarkAsSMC(userId);
      await loadData();
    } catch (err) {
      console.error("Error unmarking as SMC:", err);
      alert("Failed to unmark user as SMC: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">SMC Management</h2>
        <input
          type="text"
          value={smcSearch}
          onChange={(e) => setSmcSearch(e.target.value)}
          placeholder="Search by name or roll..."
          className="w-64 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Current SMC Members</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Roll Number</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Room Number</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {smcMembers
                    .filter((member) => {
                      if (!smcSearch.trim()) return true;
                      const q = smcSearch.toLowerCase();
                      return (
                        member.name?.toLowerCase().includes(q) ||
                        member.rollNumber?.toLowerCase().includes(q)
                      );
                    })
                    .map((member) => (
                      <tr key={member._id}>
                        <td className="border border-gray-300 px-4 py-2">{member.name}</td>
                        <td className="border border-gray-300 px-4 py-2">{member.rollNumber}</td>
                        <td className="border border-gray-300 px-4 py-2">{member.roomNumber}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          <Button
                            onClick={() => unmarkAsSMC(member._id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Remove SMC
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">All Boarders</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Roll Number</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Room Number</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {boarders
                    .filter((b) => {
                      const notSmc = !smcMembers.find((smc) => smc._id === b._id);
                      if (!notSmc) return false;
                      if (!smcSearch.trim()) return true;
                      const q = smcSearch.toLowerCase();
                      return (
                        b.name?.toLowerCase().includes(q) ||
                        b.rollNumber?.toLowerCase().includes(q)
                      );
                    })
                    .map((boarder) => (
                      <tr key={boarder._id}>
                        <td className="border border-gray-300 px-4 py-2">{boarder.name}</td>
                        <td className="border border-gray-300 px-4 py-2">{boarder.rollNumber}</td>
                        <td className="border border-gray-300 px-4 py-2">{boarder.roomNumber}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          <Button
                            onClick={() => markAsSMC(boarder._id)}
                            className="bg-blue-500 hover:bg-blue-600"
                          >
                            Mark as SMC
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default SMCTab;
