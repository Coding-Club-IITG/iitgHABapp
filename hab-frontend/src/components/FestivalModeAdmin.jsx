import React, { useState, useEffect } from "react";
import axios from "axios";

// Backend v1 defaults to PORT_V1 3001 (see server/v1/config/default.js)
const API_BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:3001/api";

/** First list entry or legacy overlay; default greeting. */
const greetingFromServer = (textsArr, legacyOverlay) => {
    if (Array.isArray(textsArr) && textsArr.length > 0) {
        const t = String(textsArr[0] ?? "").trim();
        if (t) return t;
    }
    const leg = legacyOverlay != null ? String(legacyOverlay).trim() : "";
    return leg || "Happy Diwali";
};

const FestivalModeAdmin = () => {
    console.log("[FestivalModeAdmin] API_BASE=", API_BASE);
    const [festivalId, setFestivalId] = useState(null);
    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [imageWithAlerts, setImageWithAlerts] = useState(null); // legacy
    const [imageWithoutAlerts, setImageWithoutAlerts] = useState(null); // legacy
    const [previewAlerts, setPreviewAlerts] = useState(null); // primary preview
    const [previewNoAlerts, setPreviewNoAlerts] = useState(null); // primary preview
    const [textWithAlerts, setTextWithAlerts] = useState("Happy Diwali");
    const [textWithoutAlerts, setTextWithoutAlerts] = useState("Happy Diwali");
    const [themeColor, setThemeColor] = useState("#4C4EDB");
    const [hexInput, setHexInput] = useState("#4C4EDB");
    const [hexError, setHexError] = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);
    const [cacheUntil, setCacheUntil] = useState(null);
    const [expiresAt, setExpiresAt] = useState("");
    const [token, setToken] = useState("");

    const getCacheKey = (id) => `festival_config_${id}`;

    const COLOR_PALETTE = [
        "#4C4EDB",
        "#7C3AED",
        "#DB2777",
        "#DC2626",
        "#EA580C",
        "#D97706",
        "#16A34A",
        "#0EA5E9",
        "#2563EB",
        "#111827",
    ];

    const normalizeHex = (raw) => {
        const s = (raw || "").trim();
        if (!s) return null;
        let m = s.match(/^#?([0-9A-Fa-f]{6})$/);
        if (m) return `#${m[1].toUpperCase()}`;
        m = s.match(/^#?([0-9A-Fa-f]{3})$/);
        if (m) {
            const [a, b, c] = m[1].split("");
            return `#${a}${a}${b}${b}${c}${c}`.toUpperCase();
        }
        return null;
    };

    const applyHexFromInput = () => {
        const n = normalizeHex(hexInput);
        if (n) {
            setThemeColor(n);
            setHexInput(n);
            setHexError("");
        } else {
            setHexError("Use a valid hex color, e.g. #4C4EDB or #RGB");
        }
    };

    const setThemeFromPalette = (hex) => {
        setThemeColor(hex);
        setHexInput(hex);
        setHexError("");
    };

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
            setTextWithAlerts(greetingFromServer(data.textsWithAlerts, data.imageWithAlerts?.overlayText));
            setTextWithoutAlerts(
                greetingFromServer(data.textsWithoutAlerts, data.imageWithoutAlerts?.overlayText)
            );
            const tc = data.themeColor || "#4C4EDB";
            setThemeColor(tc);
            setHexInput(tc);
            setLastUpdated(data.lastUpdatedAt);
            setCacheUntil(data.cacheUntil);
            if (data.expiresAt) {
                setExpiresAt(data.expiresAt.split("T")[0]);
            }

            // Set previews (prefer multi-image list; fall back to legacy)
            const primaryWith = (data.imagesWithAlerts?.[0]?.url || data.imageWithAlerts?.url);
            const primaryWithout = (data.imagesWithoutAlerts?.[0]?.url || data.imageWithoutAlerts?.url);
            if (primaryWith) setPreviewAlerts(getFullUrl(primaryWith));
            else setPreviewAlerts(null);
            if (primaryWithout) setPreviewNoAlerts(getFullUrl(primaryWithout));
            else setPreviewNoAlerts(null);

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
                            setTextWithAlerts(
                                greetingFromServer(cachedData.textsWithAlerts, cachedData.imageWithAlerts?.overlayText)
                            );
                            setTextWithoutAlerts(
                                greetingFromServer(
                                    cachedData.textsWithoutAlerts,
                                    cachedData.imageWithoutAlerts?.overlayText
                                )
                            );
                            const tc = cachedData.themeColor || "#4C4EDB";
                            setThemeColor(tc);
                            setHexInput(tc);
                            setLastUpdated(cachedData.lastUpdatedAt);
                            setCacheUntil(cachedData.cacheUntil);
                            if (cachedData.expiresAt) {
                                setExpiresAt(cachedData.expiresAt.split("T")[0]);
                            }
                            const primaryWith = (cachedData.imagesWithAlerts?.[0]?.url || cachedData.imageWithAlerts?.url);
                            const primaryWithout = (cachedData.imagesWithoutAlerts?.[0]?.url || cachedData.imageWithoutAlerts?.url);
                            if (primaryWith) setPreviewAlerts(getFullUrl(primaryWith));
                            else setPreviewAlerts(null);
                            if (primaryWithout) setPreviewNoAlerts(getFullUrl(primaryWithout));
                            else setPreviewNoAlerts(null);
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
            const overlay =
                imageType === "with_alerts"
                    ? (textWithAlerts || "").trim() || "Happy Diwali"
                    : (textWithoutAlerts || "").trim() || "Happy Diwali";
            formData.append("overlayText", overlay);

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

            // Update preview (server returns a relative proxy path)
            const full = getFullUrl(response.data.url);
            if (imageType === "with_alerts") setPreviewAlerts(full);
            else setPreviewNoAlerts(full);

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

    const saveFestivalConfig = async () => {
        const n = normalizeHex(hexInput);
        if (!n) {
            setHexError("Fix the hex color before saving (e.g. #4C4EDB)");
            return;
        }
        setThemeColor(n);
        setHexInput(n);
        setHexError("");
        const tw = (textWithAlerts || "").trim() || "Happy Diwali";
        const tno = (textWithoutAlerts || "").trim() || "Happy Diwali";
        try {
            setLoading(true);
            await axios.post(
                `${API_BASE}/festival-mode/admin/config`,
                {
                    textsWithAlerts: [tw],
                    textsWithoutAlerts: [tno],
                    themeColor: n,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        ...authHeader(),
                    },
                }
            );
            alert("Festival config saved");
            invalidateCache();
            loadFestivalConfig();
        } catch (error) {
            console.error("Save config error:", error);
            const msg =
                error?.response?.data?.message ||
                error?.message ||
                "Network or server error";
            alert(`Failed to save festival config: ${msg}`);
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

            <div className="bg-white rounded-lg shadow-md p-8 mb-6">
                <h2 className="text-2xl font-semibold text-gray-700 mb-6 pb-3 border-b-2 border-indigo-500">
                    Festival Content (Theme + Texts)
                </h2>

                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Theme color (HABit / BETA / name)</h3>
                    <p className="text-gray-500 text-sm mb-4">
                        While <strong>festival mode is enabled</strong>, this color is applied to <strong>HABit</strong>,{" "}
                        <strong>BETA V2</strong>, and the user&apos;s first name in the app. When festival mode is off, the app uses
                        time-of-day colors instead (purple in morning/afternoon, white on weekend/evening/rain).
                    </p>
                    <div className="flex flex-wrap gap-3 items-center mb-4">
                        {COLOR_PALETTE.map((hex) => (
                            <button
                                key={hex}
                                type="button"
                                onClick={() => setThemeFromPalette(hex)}
                                className={`w-10 h-10 rounded-full border-2 transition-all ${
                                    themeColor.toUpperCase() === hex.toUpperCase()
                                        ? "border-gray-900 scale-105"
                                        : "border-gray-200"
                                }`}
                                style={{ backgroundColor: hex }}
                                title={hex}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-end gap-3 mb-2">
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-gray-700">Hex code</span>
                            <input
                                type="text"
                                value={hexInput}
                                onChange={(e) => {
                                    setHexInput(e.target.value);
                                    setHexError("");
                                }}
                                onBlur={applyHexFromInput}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") applyHexFromInput();
                                }}
                                placeholder="#4C4EDB"
                                spellCheck={false}
                                className="w-44 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-gray-700">Picker</span>
                            <input
                                type="color"
                                value={normalizeHex(hexInput) || themeColor}
                                onChange={(e) => {
                                    const v = e.target.value.toUpperCase();
                                    setThemeColor(v);
                                    setHexInput(v);
                                    setHexError("");
                                }}
                                className="h-10 w-16 cursor-pointer rounded border border-gray-300 bg-white p-1"
                                title="Choose a color"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={applyHexFromInput}
                            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-900"
                        >
                            Apply hex
                        </button>
                    </div>
                    {hexError ? <p className="text-red-600 text-sm mb-2">{hexError}</p> : null}
                    <p className="text-gray-600 text-sm mb-2">
                        Saved value: <span className="font-mono font-semibold">{themeColor}</span>
                    </p>
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                        <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-3">Preview</p>
                        <div className="flex flex-wrap items-end gap-2">
                            <span
                                style={{
                                    color: themeColor,
                                    fontSize: "28px",
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                }}
                            >
                                HABit
                            </span>
                            <span
                                style={{
                                    color: themeColor,
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    letterSpacing: "0.03em",
                                    marginBottom: "4px",
                                }}
                            >
                                BETA V2
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-gray-200 rounded-lg p-5">
                        <label className="block">
                            <span className="text-lg font-semibold text-gray-700 mb-2 block">
                                Greeting text (with alerts)
                            </span>
                            <input
                                type="text"
                                value={textWithAlerts}
                                onChange={(e) => setTextWithAlerts(e.target.value)}
                                placeholder="e.g. Happy Diwali"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </label>
                        <p className="text-gray-500 text-xs mt-2">Shown when there are announcements or important messages.</p>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-5">
                        <label className="block">
                            <span className="text-lg font-semibold text-gray-700 mb-2 block">
                                Greeting text (without alerts)
                            </span>
                            <input
                                type="text"
                                value={textWithoutAlerts}
                                onChange={(e) => setTextWithoutAlerts(e.target.value)}
                                placeholder="e.g. Happy Diwali"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </label>
                        <p className="text-gray-500 text-xs mt-2">Shown under normal conditions.</p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        onClick={saveFestivalConfig}
                        disabled={loading}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    >
                        Save theme & texts
                    </button>
                </div>
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
                    <div className="w-full max-w-[390px] mx-auto h-[385px] bg-gray-300 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
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
                    <div className="w-full max-w-[390px] mx-auto h-[305px] bg-gray-300 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
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
                        Upload an image for each state (with alerts / without alerts)
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
                        Theme + texts are saved via config (cached up to 6 hours)
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default FestivalModeAdmin;
