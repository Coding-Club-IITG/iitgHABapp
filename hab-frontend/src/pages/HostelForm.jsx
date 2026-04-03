import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../apis/server";
import { createHostel } from "../apis/hostel";
import { getUnassignedMesses } from "../apis/mess";

export default function HostelForm() {
  const navigate = useNavigate();

  const [hostelName, setHostelName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [messId, setMessId] = useState("");
  const [unassignedMess, setUnassignedMess] = useState([]);
  const [error, setError] = useState(null);
  const [microsoftEmail, setMicrosoftEmail] = useState("");
  const [secretaryEmail, setSecretaryEmail] = useState("");
  const [hostelPassword, setHostelPassword] = useState("");

  const uploadHandle = async (e) => {
    e.preventDefault();
    setError(null);

    const hostelData = {
      hostel_name: hostelName,
      curr_cap: Number(capacity),
      microsoft_email: microsoftEmail,
      secretary_email: secretaryEmail || undefined,
      password: hostelPassword,
    };

    try {
      await createHostel(hostelData);
      navigate("/hostels");
    } catch (err) {
      console.error("Upload error:", err);
      setError("Something went wrong while uploading.");
    }
  };

  useEffect(() => {
    const fetchUnassignedMess = async () => {
      try {
        const data = await getUnassignedMesses();
        setUnassignedMess(data);
        setMessId(data.length > 0 ? data[0]._id : "");
      } catch (error) {
        console.error("Failed to fetch unassigned mess:", error);
        setError("Failed to load mess caterers.");
      }
    };

    fetchUnassignedMess();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <form
        onSubmit={uploadHandle}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-xl space-y-6"
      >
        <h2 className="text-2xl font-bold text-gray-800">Add New Hostel</h2>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div>
          <label className="block text-gray-700 font-medium mb-1">
            Hostel Name
          </label>
          <input
            type="text"
            value={hostelName}
            onChange={(e) => setHostelName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-1">
            Capacity
          </label>
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-1">
            Microsoft Email
          </label>
          <input
            type="email"
            value={microsoftEmail}
            onChange={(e) => setMicrosoftEmail(e.target.value)}
            placeholder="hostel@iitg.ac.in"
            required
            className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Enter the Microsoft email ID for this hostel (should already be
            created)
          </p>
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-1">
            Secretary Email
          </label>
          <input
            type="email"
            value={secretaryEmail}
            onChange={(e) => setSecretaryEmail(e.target.value)}
            placeholder="secretary@iitg.ac.in"
            className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Optional: email of the hostel secretary for reference and contact.
          </p>
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-1">
            Hostel Password
          </label>
          <input
            type="password"
            value={hostelPassword}
            onChange={(e) => setHostelPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            This password will be used by the hostel in HABit HQ. It is stored
            securely (hashed) on the server.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-md shadow"
          >
            Upload
          </button>
        </div>
      </form>
    </div>
  );
}
