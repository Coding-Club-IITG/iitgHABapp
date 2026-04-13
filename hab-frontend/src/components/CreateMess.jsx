import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createMessWithoutHostel, createMess } from "../apis/mess";
import { getAllHostels } from "../apis/hostel";

export default function CreateMess() {
  const [caterer, setCaterer] = useState("");
  const [hostelId, setHostelId] = useState("");
  const [hostels, setHostels] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchHostels() {
      try {
        const data = await getAllHostels();
        const list = Array.isArray(data)
          ? data
          : data?.hostels || data?.data || [];
        setHostels(list.filter((hostel) => hostel.messId == null));
      } catch (error) {
        console.error("Error fetching hostels :", error);
      }
    }
    fetchHostels();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hostelId || hostelId.length === 0) {
      try {
        await createMessWithoutHostel({
          name: caterer,
        });
        alert("Mess created successfully");
        navigate("/caterers/");
      } catch (error) {
        console.error("Error creating mess:", error);
        alert("Failed to create mess");
      }
    } else {
      try {
        await createMess({
          name: caterer,
          hostelId: hostelId,
        });
        alert("Mess created successfully");
        navigate("/caterers/");
      } catch (error) {
        console.error("Error creating mess:", error);
        alert("Failed to create mess");
      }
    }
  };

  const handleCancel = () => {
    navigate("/caterers/");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-xl space-y-6"
      >
        <h1 className="text-2xl font-bold text-center text-gray-800">
          Add New Caterer
        </h1>

        <label className="block text-gray-700 font-medium mb-1 text-lg">
          Caterer Name
        </label>
        <input
          type="text"
          placeholder="Caterer Name"
          value={caterer}
          onChange={(e) => setCaterer(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
        />
        <br />

        <label className="block text-gray-700 font-medium mb-1 text-lg">
          Hostel Name
        </label>

        <select
          value={hostelId}
          onChange={(e) => setHostelId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
        >
          <option value="">Select Hostel</option>
          {hostels.map((hostel) => (
            <option key={hostel._id} value={hostel._id}>
              {hostel.hostel_name}
            </option>
          ))}
        </select>
        <br />
        <div className="flex justify-center">
          <button
            type="submit"
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 py-2 rounded-md shadow text-lg"
          >
            Create
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 py-2 rounded-md shadow ml-10 text-lg"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
