const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema({
  menuId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Menu",
    required: false,
  },
  galaMenuId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GalaDinnerMenu",
    required: false,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["Dish", "Breads and Rice", "Others"],
    required: true,
  },
  likes: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },
});

// Exactly one of menuId or galaMenuId must be set
menuItemSchema.pre("validate", function (next) {
  const hasMenu = !!this.menuId;
  const hasGala = !!this.galaMenuId;
  if (hasMenu === hasGala) {
    next(new Error("MenuItem must have exactly one of menuId or galaMenuId"));
  } else {
    next();
  }
});

const MenuItem = mongoose.model("MenuItem", menuItemSchema);

module.exports = { MenuItem };
