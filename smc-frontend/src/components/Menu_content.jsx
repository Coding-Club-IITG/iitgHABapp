import React, { useState, useRef, useLayoutEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../apis";
import {
  Plus,
  Edit3,
  Trash2,
  Download,
  Calendar,
  Check,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

const MenuDashboard = ({
  day,
  breakfast = [],
  lunch = [],
  dinner = [],
  messId,
  onSuccessfulItemCreation,
  click, // callback to open CreateMenuFallback in parent
  menuExists = true,
  timeData = {}, // timings passed from parent (Dashboard)
}) => {
  // active day is provided by parent Dashboard via `day` prop
  const activeDay = day || "Thursday";
  const [menus, setMenus] = useState({
    Monday: { breakfast: [], lunch: [], dinner: [] },
    Tuesday: { breakfast: [], lunch: [], dinner: [] },
    Wednesday: { breakfast: [], lunch: [], dinner: [] },
    Thursday: { breakfast: [], lunch: [], dinner: [] },
    Friday: { breakfast: [], lunch: [], dinner: [] },
    Saturday: { breakfast: [], lunch: [], dinner: [] },
    Sunday: { breakfast: [], lunch: [], dinner: [] },
  });

  const [editingItem, setEditingItem] = useState(null);
  const [editValue, setEditValue] = useState("");

  // Sync incoming props into the menus for the active day whenever they change
  React.useEffect(() => {
    if (editingItem != null) return;
    setMenus((prev) => ({
      ...prev,
      [activeDay]: {
        breakfast: breakfast || [],
        lunch: lunch || [],
        dinner: dinner || [],
      },
    }));
  }, [activeDay, breakfast, lunch, dinner, editingItem]);
  const [addingTo, setAddingTo] = useState({ meal: null, category: null });
  const [newItemValue, setNewItemValue] = useState("");
  const [reorderSaving, setReorderSaving] = useState(false);

  const editInputRef = useRef(null);
  const editSelRef = useRef(null);
  const newItemInputRef = useRef(null);
  const newItemSelRef = useRef(null);
  // Times for meals per day (start/end). Stored per-day so each day's menu can have its own times.
  // Structure: { Monday: { breakfast: { start: '08:00', end: '09:00' }, ... }, ... }
  const [mealTimes, setMealTimes] = useState({
    Monday: {
      breakfast: { start: "08:00", end: "09:00" },
      lunch: { start: "13:00", end: "14:00" },
      dinner: { start: "20:00", end: "21:00" },
    },
    Tuesday: {
      breakfast: { start: "08:00", end: "09:00" },
      lunch: { start: "13:00", end: "14:00" },
      dinner: { start: "20:00", end: "21:00" },
    },
    Wednesday: {
      breakfast: { start: "08:00", end: "09:00" },
      lunch: { start: "13:00", end: "14:00" },
      dinner: { start: "20:00", end: "21:00" },
    },
    Thursday: {
      breakfast: { start: "08:00", end: "09:00" },
      lunch: { start: "13:00", end: "14:00" },
      dinner: { start: "20:00", end: "21:00" },
    },
    Friday: {
      breakfast: { start: "08:00", end: "09:00" },
      lunch: { start: "13:00", end: "14:00" },
      dinner: { start: "20:00", end: "21:00" },
    },
    Saturday: {
      breakfast: { start: "08:00", end: "09:00" },
      lunch: { start: "13:00", end: "14:00" },
      dinner: { start: "20:00", end: "21:00" },
    },
    Sunday: {
      breakfast: { start: "08:00", end: "09:00" },
      lunch: { start: "13:00", end: "14:00" },
      dinner: { start: "20:00", end: "21:00" },
    },
  });
  const [editingTimeFor, setEditingTimeFor] = useState(null); // meal being edited
  const [tempStartValue, setTempStartValue] = useState("08:00");
  const [tempEndValue, setTempEndValue] = useState("09:00");
  const [timeSaving, setTimeSaving] = useState(false);

  // Sync meal times (start/end) from parent-provided `timeData` (schema) for active day.
  React.useEffect(() => {
    if (!timeData) return;

    // Dashboard provides btime_s, btime_e, ltime_s, ltime_e, dtime_s, dtime_e
    setMealTimes((prev) => ({
      ...prev,
      [activeDay]: {
        breakfast: {
          start:
            timeData.btime_s || prev[activeDay]?.breakfast?.start || "08:00",
          end: timeData.btime_e || prev[activeDay]?.breakfast?.end || "09:00",
        },
        lunch: {
          start: timeData.ltime_s || prev[activeDay]?.lunch?.start || "13:00",
          end: timeData.ltime_e || prev[activeDay]?.lunch?.end || "14:00",
        },
        dinner: {
          start: timeData.dtime_s || prev[activeDay]?.dinner?.start || "20:00",
          end: timeData.dtime_e || prev[activeDay]?.dinner?.end || "21:00",
        },
      },
    }));
  }, [timeData, activeDay]);

  const categories = ["Dish", "Breads and Rice", "Others"];

  const isAllowedKey = (e) => {
    const allowed = /^[a-zA-Z0-9\s]+$/;
    return (
      allowed.test(e.key) ||
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "Tab" ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    );
  };

  /** Title-case each word; no trim (safe while typing). */
  const titleCaseWords = (str) =>
    str.replace(/\w\S*/g, (txt) =>
      txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    );

  /** Final value for API / stored menu rows. */
  const normalizeMenuItemName = (str) => titleCaseWords(str).trim();

  const handleMenuNameChange = (e, setValue, selRef) => {
    const el = e.target;
    if (e.nativeEvent.isComposing) {
      setValue(el.value);
      return;
    }
    selRef.current = { start: el.selectionStart, end: el.selectionEnd };
    setValue(titleCaseWords(el.value));
  };

  const handleMenuNameCompositionEnd = (e, setValue, selRef) => {
    const el = e.target;
    selRef.current = { start: el.selectionStart, end: el.selectionEnd };
    setValue(titleCaseWords(el.value));
  };

  useLayoutEffect(() => {
    if (editingItem == null || !editInputRef.current || !editSelRef.current)
      return;
    const { start, end } = editSelRef.current;
    editSelRef.current = null;
    const len = editValue.length;
    editInputRef.current.setSelectionRange(
      Math.min(start, len),
      Math.min(end, len)
    );
  }, [editValue, editingItem]);

  useLayoutEffect(() => {
    if (!addingTo.meal || !newItemInputRef.current || !newItemSelRef.current)
      return;
    const { start, end } = newItemSelRef.current;
    newItemSelRef.current = null;
    const len = newItemValue.length;
    newItemInputRef.current.setSelectionRange(
      Math.min(start, len),
      Math.min(end, len)
    );
  }, [newItemValue, addingTo.meal]);

  const addItem = async (meal, category) => {
    if (!newItemValue.trim()) return;

    // If the menu for this day doesn't exist, prompt user to create it first
    if (!menuExists) {
      alert("Menu for this day doesn't exist. Please create the menu first.");
      if (click) click();
      return;
    }

    try {
      // Backend expects capitalized meal like 'Breakfast', 'Lunch', 'Dinner'
      const mealType = meal.charAt(0).toUpperCase() + meal.slice(1);

      const payload = {
        name: normalizeMenuItemName(newItemValue),
        type: category,
        meal: mealType,
        day: day,
        messId: messId,
      };

      const response = await axios.post(
        `${API_BASE_URL}/mess/menu/item/create`,
        payload
      );

      // Optimistic UI update
      const created = response.data;
      setMenus((prev) => ({
        ...prev,
        [activeDay]: {
          ...prev[activeDay],
          [meal]: [
            ...prev[activeDay][meal],
            {
              id: created._id || created.id || Date.now(),
              name: created.name || newItemValue,
              category,
            },
          ],
        },
      }));

      setNewItemValue("");
      setAddingTo({ meal: null, category: null });

      if (onSuccessfulItemCreation) onSuccessfulItemCreation();
    } catch (error) {
      console.error("Failed to create menu item:", error);
      alert(error.response?.data?.message || "Failed to add item");
    }
  };

  const removeItem = async (meal, itemId) => {
    try {
      await axios.delete(`${API_BASE_URL}/mess/menu/item/delete`, {
        data: { _Id: itemId },
      });

      setMenus((prev) => ({
        ...prev,
        [activeDay]: {
          ...prev[activeDay],
          [meal]: prev[activeDay][meal].filter((item) => item.id !== itemId),
        },
      }));

      if (onSuccessfulItemCreation) onSuccessfulItemCreation();
    } catch (error) {
      console.error("Failed to delete menu item:", error);
      alert(error.response?.data?.message || "Failed to delete item");
    }
  };

  const startEditing = (item) => {
    setEditingItem(item.id);
    setEditValue(titleCaseWords(item.name || ""));
  };

  const saveEdit = async (meal, itemId) => {
    if (!editValue.trim()) return;

    try {
      // Modify via SMC endpoint
      await axios.post(`${API_BASE_URL}/mess/menu/modify/smc/${messId}`, {
        _Id: itemId,
        name: normalizeMenuItemName(editValue),
      });

      setMenus((prev) => ({
        ...prev,
        [activeDay]: {
          ...prev[activeDay],
          [meal]: prev[activeDay][meal].map((item) =>
            item.id === itemId
              ? { ...item, name: normalizeMenuItemName(editValue) }
              : item
          ),
        },
      }));

      setEditingItem(null);
      setEditValue("");

      if (onSuccessfulItemCreation) onSuccessfulItemCreation();
    } catch (error) {
      console.error("Failed to update menu item:", error);
      alert(error.response?.data?.message || "Failed to update item");
    }
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditValue("");
  };

  const cancelAdd = () => {
    setAddingTo({ meal: null, category: null });
    setNewItemValue("");
  };

  const getItemsByCategory = (meal, category) => {
    return menus[activeDay][meal].filter((item) => item.category === category);
  };

  const mealNeighborSwapIndex = (list, idx, direction, cat) => {
    if (direction === "up") {
      for (let j = idx - 1; j >= 0; j--) {
        if (list[j].category === cat) return j;
      }
    } else {
      for (let j = idx + 1; j < list.length; j++) {
        if (list[j].category === cat) return j;
      }
    }
    return -1;
  };

  const canReorderItem = (meal, itemId, direction) => {
    const list = menus[activeDay]?.[meal];
    if (!list?.length) return false;
    const idx = list.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;
    return (
      mealNeighborSwapIndex(list, idx, direction, list[idx].category) >= 0
    );
  };

  const moveMenuItemInCategory = async (meal, itemId, direction) => {
    if (!messId || editingItem != null || reorderSaving) return;
    const list = [...menus[activeDay][meal]];
    const idx = list.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const cat = list[idx].category;
    const swapIdx = mealNeighborSwapIndex(list, idx, direction, cat);
    if (swapIdx === -1) return;

    const next = [...list];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const snapshot = structuredClone(menus);

    setReorderSaving(true);
    setMenus((prev) => ({
      ...prev,
      [activeDay]: {
        ...prev[activeDay],
        [meal]: next,
      },
    }));

    const mealType = meal.charAt(0).toUpperCase() + meal.slice(1);
    try {
      await axios.post(
        `${API_BASE_URL}/mess/menu/items/reorder/smc/${messId}`,
        {
          day,
          type: mealType,
          itemIds: next.map((i) => i.id),
        }
      );
      if (onSuccessfulItemCreation) onSuccessfulItemCreation();
    } catch (err) {
      setMenus(snapshot);
      console.error(err);
      alert(err.response?.data?.message || "Could not save item order");
    } finally {
      setReorderSaving(false);
    }
  };

  // If menu for this day doesn't exist, show a CTA to create it
  if (!menuExists) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-lg text-center">
        <h3 className="text-lg font-semibold mb-2">No menu for {activeDay}</h3>
        <p className="text-sm text-gray-600">
          Create a menu to start adding items for Breakfast, Lunch and Dinner.
        </p>
        <div className="mt-4">
          <button
            onClick={() => click && click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Create Menu
          </button>
        </div>
      </div>
    );
  }

  // Must be a render function, not a nested component: a new `const MealSection = () =>`
  // each render would change component identity and remount inputs (caret jumps to end).
  const renderMealSection = (meal, title) => (
    <div className="bg-white border border-gray-200 rounded-lg w-full">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          {editingTimeFor === meal ? (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={tempStartValue}
                onChange={(e) => setTempStartValue(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded"
              />
              <span className="text-sm text-gray-500">to</span>
              <input
                type="time"
                value={tempEndValue}
                onChange={(e) => setTempEndValue(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded"
              />
              <button
                onClick={async () => {
                  try {
                    setTimeSaving(true);
                    const mealType =
                      meal.charAt(0).toUpperCase() + meal.slice(1);
                    const payload = { day: activeDay, type: mealType };

                    // Attach appropriate field names expected by the server
                    if (mealType === "Breakfast") {
                      payload.btime_s = tempStartValue;
                      payload.btime_e = tempEndValue;
                    } else if (mealType === "Lunch") {
                      payload.ltime_s = tempStartValue;
                      payload.ltime_e = tempEndValue;
                    } else if (mealType === "Dinner") {
                      payload.dtime_s = tempStartValue;
                      payload.dtime_e = tempEndValue;
                    }

                    await axios.post(
                      `${API_BASE_URL}/mess/menu/time/update/smc/${messId}`,
                      payload
                    );

                    // Update local state optimistically after successful save
                    setMealTimes((prev) => ({
                      ...prev,
                      [activeDay]: {
                        ...prev[activeDay],
                        [meal]: { start: tempStartValue, end: tempEndValue },
                      },
                    }));
                    setEditingTimeFor(null);
                  } catch (err) {
                    console.error("Failed to save meal time:", err);
                    alert(
                      err.response?.data?.message ||
                        "Failed to update meal time. Please try again."
                    );
                  } finally {
                    setTimeSaving(false);
                  }
                }}
                disabled={timeSaving}
                className="px-2 py-1 bg-green-600 text-white rounded text-sm disabled:opacity-60"
              >
                {timeSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditingTimeFor(null)}
                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {mealTimes[activeDay]
                  ? `${mealTimes[activeDay][meal].start} - ${mealTimes[activeDay][meal].end}`
                  : "--:--"}
              </span>
              <button
                onClick={() => {
                  setEditingTimeFor(meal);
                  setTempStartValue(
                    mealTimes[activeDay]?.[meal]?.start || "08:00"
                  );
                  setTempEndValue(mealTimes[activeDay]?.[meal]?.end || "09:00");
                }}
                className="text-blue-600 hover:underline text-sm"
              >
                Change
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 w-40">
                  Category
                </th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">
                  Items
                </th>
                <th className="text-right py-2 px-3 text-sm font-medium text-gray-700 w-36">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const items = getItemsByCategory(meal, category);
                const isAddingHere =
                  addingTo.meal === meal && addingTo.category === category;

                return (
                  <React.Fragment key={category}>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-3 font-medium text-gray-800 align-top w-40">
                        {category}
                      </td>
                      <td className="py-3 px-3 w-auto">
                        {items.length === 0 && !isAddingHere ? (
                          <span className="text-gray-400 text-sm">
                            No items yet
                          </span>
                        ) : (
                          <div className="space-y-2">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between bg-gray-50 rounded p-2"
                              >
                                {editingItem === item.id ? (
                                  <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editValue}
                                    onChange={(e) =>
                                      handleMenuNameChange(
                                        e,
                                        setEditValue,
                                        editSelRef
                                      )
                                    }
                                    onCompositionEnd={(e) =>
                                      handleMenuNameCompositionEnd(
                                        e,
                                        setEditValue,
                                        editSelRef
                                      )
                                    }
                                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
                                    onKeyDown={(e) => {
                                      if (!isAllowedKey(e)) e.preventDefault();
                                      if (e.key === "Enter")
                                        saveEdit(meal, item.id);
                                      if (e.key === "Escape") cancelEdit();
                                    }}
                                    onPaste={(e) => {
                                      e.preventDefault();
                                      const pasted = e.clipboardData
                                        .getData("text")
                                        .replace(/[^a-zA-Z0-9\s]/g, "");
                                      const target = e.target;
                                      const start = target.selectionStart;
                                      const end = target.selectionEnd;
                                      const merged =
                                        editValue.slice(0, start) +
                                        pasted +
                                        editValue.slice(end);
                                      const next = titleCaseWords(merged);
                                      const caret = Math.min(
                                        start + pasted.length,
                                        next.length
                                      );
                                      editSelRef.current = {
                                        start: caret,
                                        end: caret,
                                      };
                                      setEditValue(next);
                                    }}
                                    autoFocus
                                  />
                                ) : (
                                  <span className="text-sm text-gray-700 flex-1">
                                    {item.name}
                                  </span>
                                )}

                                <div className="flex items-center gap-1 ml-2">
                                  {editingItem === item.id ? (
                                    <>
                                      <button
                                        onClick={() => saveEdit(meal, item.id)}
                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={cancelEdit}
                                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        title="Move up in this category"
                                        disabled={
                                          reorderSaving ||
                                          !canReorderItem(
                                            meal,
                                            item.id,
                                            "up"
                                          )
                                        }
                                        onClick={() =>
                                          moveMenuItemInCategory(
                                            meal,
                                            item.id,
                                            "up"
                                          )
                                        }
                                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none"
                                      >
                                        <ChevronUp className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        title="Move down in this category"
                                        disabled={
                                          reorderSaving ||
                                          !canReorderItem(
                                            meal,
                                            item.id,
                                            "down"
                                          )
                                        }
                                        onClick={() =>
                                          moveMenuItemInCategory(
                                            meal,
                                            item.id,
                                            "down"
                                          )
                                        }
                                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none"
                                      >
                                        <ChevronDown className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => startEditing(item)}
                                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeItem(meal, item.id)
                                        }
                                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}

                            {isAddingHere && (
                              <div className="flex items-center gap-2 bg-blue-50 rounded p-2">
                                <input
                                  ref={newItemInputRef}
                                  type="text"
                                  value={newItemValue}
                                  onChange={(e) =>
                                    handleMenuNameChange(
                                      e,
                                      setNewItemValue,
                                      newItemSelRef
                                    )
                                  }
                                  onCompositionEnd={(e) =>
                                    handleMenuNameCompositionEnd(
                                      e,
                                      setNewItemValue,
                                      newItemSelRef
                                    )
                                  }
                                  placeholder="Enter item name..."
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
                                  onKeyDown={(e) => {
                                    if (!isAllowedKey(e)) e.preventDefault();
                                    if (e.key === "Enter")
                                      addItem(meal, category);
                                    if (e.key === "Escape") cancelAdd();
                                  }}
                                  onPaste={(e) => {
                                    e.preventDefault();
                                    const pasted = e.clipboardData
                                      .getData("text")
                                      .replace(/[^a-zA-Z0-9\s]/g, "");
                                    const target = e.target;
                                    const start = target.selectionStart;
                                    const end = target.selectionEnd;
                                    const merged =
                                      newItemValue.slice(0, start) +
                                      pasted +
                                      newItemValue.slice(end);
                                    const next = titleCaseWords(merged);
                                    const caret = Math.min(
                                      start + pasted.length,
                                      next.length
                                    );
                                    newItemSelRef.current = {
                                      start: caret,
                                      end: caret,
                                    };
                                    setNewItemValue(next);
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => addItem(meal, category)}
                                  className="p-1 text-green-600 hover:bg-green-100 rounded"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelAdd}
                                  className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top w-36 text-right">
                        <button
                          onClick={() => setAddingTo({ meal, category })}
                          disabled={isAddingHere}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Dashboard already renders headers and day-tabs; this component only shows the meal sections
  return (
    <div className="mt-4 w-full">
      <div className="space-y-6">
        {renderMealSection("breakfast", "Breakfast")}
        {renderMealSection("lunch", "Lunch")}
        {renderMealSection("dinner", "Dinner")}
      </div>
    </div>
  );
};

export default MenuDashboard;
