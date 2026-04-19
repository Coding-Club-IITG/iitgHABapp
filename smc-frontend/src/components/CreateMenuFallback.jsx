import React, { useState, useEffect } from "react";
import axios from "axios"; // Assuming you'll make an API call
import { API_BASE_URL } from "../apis"; // Assuming you have a common API base URL defined
import Button from "./ui/Button";
import Card from "./ui/Card";

// CreateMenuFallback component receives onSuccessfulCreation prop
function CreateMenuFallback({ onSuccessfulCreation, activeDay, messId }) {
  const [day, setDay] = useState(activeDay); // Default to Friday
  const [BstartTime, setBStartTime] = useState("");
  const [BendTime, setBEndTime] = useState("");
  const [LstartTime, setLStartTime] = useState("");
  const [LendTime, setLEndTime] = useState("");
  const [DstartTime, setDStartTime] = useState("");
  const [DendTime, setDEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const formData = {
      messId: messId,
      day: day,
      BstartTime: BstartTime,
      BendTime: BendTime,
      LstartTime: LstartTime,
      LendTime: LendTime,
      DstartTime: DstartTime,
      DendTime: DendTime,
      items: [],
    };

    console.log("Attempting to create menu with data:", formData);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/mess/menu/create`,
        formData,
        {
          withCredentials: true,
        }
      );

      console.log("Menu creation successful:", response.data);
      setSuccessMessage("Menu created successfully!");

      if (onSuccessfulCreation) {
        onSuccessfulCreation();
      }

      // Reset form
      setDay("");
      setBStartTime("");
      setBEndTime("");
      setLStartTime("");
      setLEndTime("");
      setDStartTime("");
      setDEndTime("");
    } catch (err) {
      console.error(
        "Error creating menu:",
        err.response ? err.response.data : err.message
      );
      setError(
        err.response?.data?.message ||
          "Failed to create menu. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Reset form when activeDay changes
    if (activeDay) {
      setDay(activeDay);
      setBStartTime("");
      setBEndTime("");
      setLStartTime("");
      setLEndTime("");
      setDStartTime("");
      setDEndTime("");
    }
  }, [activeDay]);

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-lg -mt-6 mb-4">
          <h2 className="text-2xl font-bold text-center">
            Create New Menu for a Day
          </h2>
        </div>

        {/* Form Container */}
        <div className="p-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error/Success Messages */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                {successMessage}
              </div>
            )}

            {/* Day Selection */}
            <div className="space-y-2">
              <label
                htmlFor="day"
                className="block text-sm font-semibold text-gray-700"
              >
                Day of the Week
              </label>
              <select
                id="day"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                required
                disabled
                style={{ backgroundColor: "#f3f4f6" }} // Light gray background
              >
                <option value="">Select a day</option>
                {daysOfWeek.map((dayOption) => (
                  <option key={dayOption} value={dayOption}>
                    {dayOption}
                  </option>
                ))}
              </select>
            </div>

            {/* Breakfast Section */}
            <div className="bg-orange-50 rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-orange-800 border-b border-orange-200 pb-2">
                🌅 Breakfast
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Start Time
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={BstartTime}
                    onChange={(e) => setBStartTime(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    End Time
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={BendTime}
                    onChange={(e) => setBEndTime(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* Lunch Section */}
            <div className="bg-yellow-50 rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-yellow-800 border-b border-yellow-200 pb-2">
                ☀️ Lunch
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Start Time
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={LstartTime}
                    onChange={(e) => setLStartTime(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    End Time
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={LendTime}
                    onChange={(e) => setLEndTime(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* Dinner Section */}
            <div className="bg-purple-50 rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-purple-800 border-b border-purple-200 pb-2">
                🌙 Dinner
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Start Time
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={DstartTime}
                    onChange={(e) => setDStartTime(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    End Time
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={DendTime}
                    onChange={(e) => setDEndTime(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating Menu...</span>
                </div>
              ) : (
                "Add Menu"
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

export default CreateMenuFallback;
