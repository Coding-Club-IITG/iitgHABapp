import React, { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:3000/api";

const FestivalModeAdmin = () => {
    console.log("[FestivalModeAdmin] API_BASE=", API_BASE);
    const [festivalId, setFestivalId] = useState(null);
    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [imageWithAlerts, setImageWithAlerts] = useState(null);
    const [imageWithoutAlerts, setImageWithoutAlerts] = useState(null);
    const [previewAlerts, setPreviewAlerts] = useState(null);
    const [previewNoAlerts, setPreviewNoAlerts] = useState(null);
    const [overlayTextAlerts, setOverlayTextAlerts] = useState("Happy Diwali");
    const [overlayTextNoAlerts, setOverlayTextNoAlerts] = useState("Happy Diwali");
    const [lastUpdated, setLastUpdated] = useState(null);
    const [cacheUntil, setCacheUntil] = useState(null);
    const [expiresAt, setExpiresAt] = useState("");
    const [token, setToken] = useState("");

    const getCacheKey = (id) => `festival_config_${id}`;

    useEffect(() => {
        loadToken();
        loadFestivalConfig();
    }, []);

    const loadToken = async () => {
        const savedToken =
            localStorage.getItem("access_token") || localStorage.getItem("token");
        setToken(savedToken || "");
    };

    const authHeader = () => {
        const savedToken = token || localStorage.getItem("access_token") || localStorage.getItem("token");
        const header = savedToken ? { Authorization: `Bearer ${savedToken}` } : {};
        console.log("[FestivalModeAdmin] authHeader=", header);
        return header;
    };

    const invalidateCache = () => {
        // Clear current festival config cache to force refresh
        if (festivalId) {
            localStorage.removeItem(getCacheKey(festivalId));
            console.log("[FestivalModeAdmin] Invalidated cache for festival:", festivalId);
        }
    };

    const getFullUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        const urlObj = new URL(API_BASE);
        return `${urlObj.origin}${url}`;
    };

    const loadFestivalConfig = async () => {
        try {
            setLoading(true);

            // Try to fetch from server
            const response = await axios.get(`${API_BASE}/festival-mode/admin/config`, {
                headers: authHeader(),
            });

            const data = response.data;
            const id = data.festivalId;

            // Always update state with fresh data
            setFestivalId(id);
            setIsEnabled(data.isEnabled);
            setImageWithAlerts(data.imageWithAlerts);
            setImageWithoutAlerts(data.imageWithoutAlerts);
            setLastUpdated(data.lastUpdatedAt);
            setCacheUntil(data.cacheUntil);
            if (data.expiresAt) {
                setExpiresAt(data.expiresAt.split("T")[0]);
            }

            // Set previews
            if (data.imageWithAlerts?.url) setPreviewAlerts(getFullUrl(data.imageWithAlerts.url));
            if (data.imageWithoutAlerts?.url) setPreviewNoAlerts(getFullUrl(data.imageWithoutAlerts.url));
            setOverlayTextAlerts(data.imageWithAlerts?.overlayText || "Happy Diwali");
            setOverlayTextNoAlerts(data.imageWithoutAlerts?.overlayText || "Happy Diwali");

            // Cache entire response keyed by festivalId
            if (id) {
                localStorage.setItem(getCacheKey(id), JSON.stringify(data));
                console.log("[FestivalModeAdmin] Cached config for festival:", id);
            }
        } catch (error) {
            console.error("Error loading festival config:", error);

            // Fallback to cached data if available
            // Try to find any cached festival config
            const keys = Object.keys(localStorage);
            let foundCache = false;
            for (const key of keys) {
                if (key.startsWith("festival_config_")) {
                    try {
                        const cachedData = JSON.parse(localStorage.getItem(key));
                        const cacheTime = new Date(cachedData.cacheUntil);

                        // Use cache if not yet expired
                        if (new Date() < cacheTime) {
                            console.log("[FestivalModeAdmin] Using valid cached config");
                            const id = cachedData.festivalId;
                            setFestivalId(id);
                            setIsEnabled(cachedData.isEnabled);
                            setImageWithAlerts(cachedData.imageWithAlerts);
                            setImageWithoutAlerts(cachedData.imageWithoutAlerts);
                            setLastUpdated(cachedData.lastUpdatedAt);
                            setCacheUntil(cachedData.cacheUntil);
                            setOverlayTextAlerts(cachedData.imageWithAlerts?.overlayText || "Happy Diwali");
                            setOverlayTextNoAlerts(cachedData.imageWithoutAlerts?.overlayText || "Happy Diwali");
                            if (cachedData.expiresAt) {
                                setExpiresAt(cachedData.expiresAt.split("T")[0]);
                            }
                            if (cachedData.imageWithAlerts?.url) setPreviewAlerts(getFullUrl(cachedData.imageWithAlerts.url));
                            if (cachedData.imageWithoutAlerts?.url) setPreviewNoAlerts(getFullUrl(cachedData.imageWithoutAlerts.url));
                            foundCache = true;
                            break;
                        }
                    } catch (e) {
                        console.warn("Error parsing cached festival config:", e);
                    }
                }
            }

            if (!foundCache) {
                alert("Failed to load festival mode config");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (file, imageType) => {
        if (!file || !file.type.startsWith("image/")) {
            alert("Please select an image file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert("Image must be less than 5MB");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("file", file);
            formData.append("imageType", imageType);
            // Add overlay text
            if (imageType === "with_alerts") {
                formData.append("overlayText", overlayTextAlerts);
            } else {
                formData.append("overlayText", overlayTextNoAlerts);
            }

            const url = `${API_BASE}/festival-mode/upload`;
            console.log("[FestivalModeAdmin] Upload URL=", url);
            const response = await axios.post(url, formData, {
                timeout: 20000,
                headers: {
                    "Content-Type": "multipart/form-data",
                    ...authHeader(),
                },
            });

            alert(`Image uploaded successfully: ${imageType}`);

            // Update preview
            if (imageType === "with_alerts") {
                setPreviewAlerts(response.data.url);
            } else {
                setPreviewNoAlerts(response.data.url);
            }

            // Invalidate cache and reload
            invalidateCache();
            loadFestivalConfig();
        } catch (error) {
            console.error("Upload error:", error);
            if (error.response) {
                console.error("Upload response data:", error.response.data);
            }
            alert(`Failed to upload image: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleToggleFestivalMode = async () => {
        try {
            setLoading(true);
            await axios.post(
                `${API_BASE}/festival-mode/toggle`,
                {
                    isEnabled: !isEnabled,
                    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                },
                {
                    headers: authHeader(),
                }
            );

            setIsEnabled(!isEnabled);
            alert(`Festival mode ${!isEnabled ? "enabled" : "disabled"}`);
            // Invalidate cache and reload
            invalidateCache();
            loadFestivalConfig();
        } catch (error) {
            console.error("Toggle error:", error);
            alert("Failed to toggle festival mode");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteImage = async (imageType) => {
        if (!window.confirm(`Delete ${imageType} image?`)) return;

        try {
            setLoading(true);
            await axios.delete(`${API_BASE}/festival-mode/image/${imageType}`, {
                headers: authHeader(),
            });

            alert(`Image deleted: ${imageType}`);
            if (imageType === "with_alerts") {
                setPreviewAlerts(null);
            } else {
                setPreviewNoAlerts(null);
            }
            // Invalidate cache and reload
            invalidateCache();
            loadFestivalConfig();
        } catch (error) {
            console.error("Delete error:", error);
            alert("Failed to delete image");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen text-lg text-indigo-600">
                Loading festival mode config...
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 bg-gradient-to-br from-blue-50 via-blue-100 to-purple-100 min-h-screen">
            <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">
                🎉 Festival Mode Management
            </h1>

            {/* Status Section */}
            <div className="bg-white rounded-lg shadow-md p-8 mb-6">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4 pb-3 border-b-2 border-indigo-500">
                    Festival Mode Status
                </h2>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-4 text-lg cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={handleToggleFestivalMode}
                            disabled={loading}
                            className="w-6 h-6 cursor-pointer"
                        />
                        <span className={`font-semibold ${isEnabled ? "text-green-600" : "text-red-600"}`}>
                            {isEnabled ? "✓ Enabled" : "✗ Disabled"}
                        </span>
                    </label>
                </div>
                {lastUpdated && (
                    <p className="text-gray-500 text-sm mt-3">
                        Last updated: {new Date(lastUpdated).toLocaleString()}
                    </p>
                )}
            </div>

            {/* Expiration Section */}
            <div className="bg-white rounded-lg shadow-md p-8 mb-6">
                <h3 className="text-xl font-semibold text-gray-700 mb-3">Auto-Disable After Festival</h3>
                <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    placeholder="Optional expiration date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-base mt-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-gray-500 text-sm mt-2">Leave empty for manual disable</p>
            </div>

            {/* Image Upload Section */}
            <div className="bg-white rounded-lg shadow-md p-8 mb-6">
                <h2 className="text-2xl font-semibold text-gray-700 mb-6 pb-3 border-b-2 border-indigo-500">
                    Upload Festival Images
                </h2>

                {/* With Alerts Image */}
                <div className="border-2 border-dashed border-indigo-500 rounded-lg p-8 mb-8 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">
                        Image with Alerts (Newsletter/Announcements)
                    </h3>
                    <div className="w-full h-80 bg-gray-300 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
                        {previewAlerts ? (
                            <>
                                <img
                                    src={previewAlerts}
                                    alt="With alerts preview"
                                    className="w-full h-full object-cover rounded-lg"
                                />
                                <button
                                    onClick={() => handleDeleteImage("with_alerts")}
                                    className="absolute bottom-3 right-3 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                                    disabled={uploading}
                                >
                                    Delete
                                </button>
                            </>
                        ) : (
                            <p className="text-gray-600">No image uploaded</p>
                        )}
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Overlay Text (e.g., "Happy Diwali")
                        </label>
                        <input
                            type="text"
                            value={overlayTextAlerts}
                            onChange={(e) => setOverlayTextAlerts(e.target.value)}
                            placeholder="Enter overlay text"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <label className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold cursor-pointer hover:bg-indigo-700 transition-colors mt-4">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    handleImageUpload(e.target.files[0], "with_alerts");
                                }
                            }}
                            disabled={uploading}
                            className="hidden"
                        />
                        Choose Image
                    </label>
                </div>

                {/* Without Alerts Image */}
                <div className="border-2 border-dashed border-indigo-500 rounded-lg p-8 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">
                        Image without Alerts (Normal)
                    </h3>
                    <div className="w-full h-80 bg-gray-300 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
                        {previewNoAlerts ? (
                            <>
                                <img
                                    src={previewNoAlerts}
                                    alt="Without alerts preview"
                                    className="w-full h-full object-cover rounded-lg"
                                />
                                <button
                                    onClick={() => handleDeleteImage("without_alerts")}
                                    className="absolute bottom-3 right-3 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                                    disabled={uploading}
                                >
                                    Delete
                                </button>
                            </>
                        ) : (
                            <p className="text-gray-600">No image uploaded</p>
                        )}
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Overlay Text (e.g., "Happy Diwali")
                        </label>
                        <input
                            type="text"
                            value={overlayTextNoAlerts}
                            onChange={(e) => setOverlayTextNoAlerts(e.target.value)}
                            placeholder="Enter overlay text"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <label className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold cursor-pointer hover:bg-indigo-700 transition-colors mt-4">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    handleImageUpload(e.target.files[0], "without_alerts");
                                }
                            }}
                            disabled={uploading}
                            className="hidden"
                        />
                        Choose Image
                    </label>
                </div>
            </div>

            {uploading && (
                <div className="fixed top-5 right-5 px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold z-50">
                    Uploading image...
                </div>
            )}

            {/* Info Box */}
            <div className="bg-gray-200 border-l-4 border-blue-500 rounded-lg p-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">ℹ️ How it Works</h3>
                <ul className="space-y-2">
                    <li className="text-gray-700 pl-6 relative">
                        <span className="absolute left-0 text-green-600 font-bold">✓</span>
                        Upload two festival images above
                    </li>
                    <li className="text-gray-700 pl-6 relative">
                        <span className="absolute left-0 text-green-600 font-bold">✓</span>
                        Enable festival mode to activate
                    </li>
                    <li className="text-gray-700 pl-6 relative">
                        <span className="absolute left-0 text-green-600 font-bold">✓</span>
                        Images will automatically update in the app (no Play Store update needed)
                    </li>
                    <li className="text-gray-700 pl-6 relative">
                        <span className="absolute left-0 text-green-600 font-bold">✓</span>
                        App shows "with alerts" image when there are announcements/newsletters
                    </li>
                    <li className="text-gray-700 pl-6 relative">
                        <span className="absolute left-0 text-green-600 font-bold">✓</span>
                        App shows "without alerts" image under normal conditions
                    </li>
                    <li className="text-gray-700 pl-6 relative">
                        <span className="absolute left-0 text-green-600 font-bold">✓</span>
                        Optional: Set expiration date to auto-disable after festival
                    </li>
                    <li className="text-gray-700 pl-6 relative">
                        <span className="absolute left-0 text-green-600 font-bold">✓</span>
                        Changes propagate to apps within 6 hours (or instantly on next refresh)
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default FestivalModeAdmin;
