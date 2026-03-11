import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../apiClient";
import { Plus, Edit3, Trash2, Download } from "lucide-react";
import Card from "./ui/Card";
import Button from "./ui/Button";

const CATEGORIES = ["Starters", "Main Course", "Desserts"];
const ITEM_TYPES = ["Dish", "Breads and Rice", "Others"];

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeDisplay(str) {
  if (!str || typeof str !== "string") return null;
  const match = str.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return str;
  const h = parseInt(match[1], 10);
  const m = match[2];
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${h12}:${m} ${ampm}`;
}

export default function GalaDinnerContent() {
  const [data, setData] = useState({
    galaDinner: null,
    menus: [],
  });
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemType, setNewItemType] = useState("Dish");
  const [editingId, setEditingId] = useState(null);
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [editName, setEditName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refreshMenuItems = useCallback(async (galaDinnerMenuId) => {
    try {
      const response = await apiClient.get(
        `/gala/menu/${galaDinnerMenuId}/items`
      );
      const items = response.data || [];
      setData((prev) => ({
        ...prev,
        menus: prev.menus.map((m) =>
          m._id === galaDinnerMenuId ? { ...m, items } : m
        ),
      }));
    } catch (err) {
      console.error("Failed to refresh menu items:", err);
    }
  }, []);

  const fetchGala = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/gala/upcoming-with-menus");
      setData({
        galaDinner: response.data.galaDinner || null,
        menus: response.data.menus || [],
      });
    } catch (err) {
      console.error("Failed to fetch Gala Dinner:", err);
      setData({ galaDinner: null, menus: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGala();
  }, [fetchGala]);

  const handleAddItem = async (galaMenuId, category) => {
    if (!newItemName.trim()) return;
    const typeToSend =
      category === "Main Course" ? newItemType : "Dish";
    try {
      setSubmitting(true);
      await apiClient.post("/gala/menu/item", {
        galaMenuId,
        name: newItemName.trim(),
        type: typeToSend,
      });
      setAddingTo(null);
      setNewItemName("");
      setNewItemType("Dish");
      await refreshMenuItems(galaMenuId);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingId || !editName.trim()) return;
    const menuIdToRefresh = editingMenuId;
    try {
      setSubmitting(true);
      await apiClient.patch("/gala/menu/item", {
        _Id: editingId,
        name: editName.trim(),
      });
      setEditingId(null);
      setEditingMenuId(null);
      setEditName("");
      if (menuIdToRefresh) await refreshMenuItems(menuIdToRefresh);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId, galaMenuId) => {
    if (!confirm("Delete this item?")) return;
    try {
      setSubmitting(true);
      await apiClient.delete("/gala/menu/item", { data: { _Id: itemId } });
      if (galaMenuId) await refreshMenuItems(galaMenuId);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete item");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-600">Loading Gala Dinner...</span>
      </div>
    );
  }

  if (!data.galaDinner || !data.menus.length) {
    return (
      <Card>
        <h2 className="text-xl font-semibold text-gray-900">Gala Dinner</h2>
        <p className="mt-2 text-gray-500">No upcoming Gala Dinner scheduled.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-2xl font-bold text-gray-900">Gala Dinner</h1>
        <p className="mt-1 text-gray-600">
          Date: <strong>{formatDate(data.galaDinner.date)}</strong>
        </p>
        {(data.galaDinner.startersServingStartTime || data.galaDinner.dinnerServingStartTime) && (
          <p className="mt-1 text-gray-600">
            Starters at <strong>{formatTimeDisplay(data.galaDinner.startersServingStartTime) || "—"}</strong>
            {data.galaDinner.dinnerServingStartTime && (
              <> · Dinner at <strong>{formatTimeDisplay(data.galaDinner.dinnerServingStartTime)}</strong></>
            )}
          </p>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {data.menus.map((menu) => (
          <Card key={menu._id} className="flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">
              {menu.category}
            </h3>

            {menu.qrCode?.qr_base64 && (
              <div className="my-3 relative inline-block mx-auto">
                <img
                  src={menu.qrCode.qr_base64}
                  alt={`QR ${menu.category}`}
                  className="w-32 h-32 object-contain border border-gray-200 rounded"
                />
                <a
                  href={menu.qrCode.qr_base64}
                  download={`gala-qr-${menu.category.replace(/\s+/g, "-")}.png`}
                  className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                  title="Download QR code"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            )}

            <ul className="flex-1 mt-2 space-y-1">
              {(menu.items || []).map((item) => (
                <li
                  key={item._id}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50"
                >
                  {editingId === item._id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleUpdateItem}
                        disabled={submitting}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditingMenuId(null);
                          setEditName("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-gray-800">{item.name}</span>
                      <span className="text-xs text-gray-400">{item.type}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item._id);
                            setEditingMenuId(menu._id);
                            setEditName(item.name);
                          }}
                          className="p-1 text-gray-500 hover:text-blue-600"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item._id, menu._id)}
                          disabled={submitting}
                          className="p-1 text-gray-500 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {addingTo === menu._id ? (
              <div className="mt-3 flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Item name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
                {menu.category === "Main Course" && (
                  <select
                    value={newItemType}
                    onChange={(e) => setNewItemType(e.target.value)}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded"
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAddItem(menu._id, menu.category)}
                    disabled={submitting || !newItemName.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAddingTo(null);
                      setNewItemName("");
                      setNewItemType("Dish");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setAddingTo(menu._id)}
              >
                <Plus className="w-4 h-4 mr-1" /> Add item
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
