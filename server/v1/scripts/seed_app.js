// Login via Microsoft with REAL_ROLL_NUMBER after running script

const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../../server/.env") });

const { Hostel } = require("../modules/hostel/hostelModel");
const { Mess } = require("../modules/mess/messModel");
const { User } = require("../modules/user/userModel");
const UserAllocHostel = require("../modules/hostel/hostelAllocModel");
const { Menu } = require("../modules/mess/menuModel");
const { MenuItem } = require("../modules/mess/menuItemModel");

const REAL_ROLL_NUMBER = process.env.REAL_ROLL_NUMBER;

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const mealTypes = ["Breakfast", "Lunch", "Dinner"];

const seedDatabase = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully.\n");

    console.log("Clearing old data to prevent duplicates...");
    await Hostel.deleteMany({});
    await Mess.deleteMany({});
    await User.deleteMany({});
    await UserAllocHostel.deleteMany({});
    await Menu.deleteMany({});
    await MenuItem.deleteMany({});

    // 1. CREATE HOSTELS & MESSES
    console.log("Creating Hostels and Messes...");

    const brahmaputra = await Hostel.create({
      hostel_name: "Brahmaputra",
      microsoft_email: "brahmaputra_manager@iitg.ac.in",
      secretary_email: "brahmaputra_secy@iitg.ac.in",
      curr_cap: 0,
    });

    const barak = await Hostel.create({
      hostel_name: "Barak",
      microsoft_email: "barak_manager@iitg.ac.in",
      secretary_email: "barak_secy@iitg.ac.in",
      curr_cap: 0,
    });

    const brahmaputraMess = await Mess.create({
      name: "Brahmaputra Mess",
      hostelId: brahmaputra._id,
    });

    const barakMess = await Mess.create({
      name: "Barak Mess",
      hostelId: barak._id,
    });

    brahmaputra.messId = brahmaputraMess._id;
    await brahmaputra.save();

    barak.messId = barakMess._id;
    await barak.save();

    const hostelMesses = [
      { hostel: brahmaputra, mess: brahmaputraMess },
      { hostel: barak, mess: barakMess },
    ];

    // 2. CREATE WEEKLY MESS MENU & ITEMS
    console.log("Generating Menus & Cooking Food Items...");

    for (const hm of hostelMesses) {
      for (let i = 0; i < daysOfWeek.length; i++) {
        for (const meal of mealTypes) {
          // A) Create the Menu Container
          const menu = await Menu.create({
            messId: hm.mess._id,
            day: daysOfWeek[i],
            type: meal,
            startTime:
              meal === "Breakfast"
                ? "07:30"
                : meal === "Lunch"
                  ? "12:30"
                  : "19:30",
            endTime:
              meal === "Breakfast"
                ? "09:30"
                : meal === "Lunch"
                  ? "14:30"
                  : "21:30",
            items: [],
          });

          // B) Create Food Items
          let foodData = [];
          if (meal === "Breakfast") {
            foodData = [
              { name: "Aloo Paratha & Curd", type: "Dish", menuId: menu._id },
              { name: "Tea & Coffee", type: "Others", menuId: menu._id },
            ];
          } else if (meal === "Lunch") {
            foodData = [
              { name: "Paneer Butter Masala", type: "Dish", menuId: menu._id },
              {
                name: "Dal Tadka & Rice",
                type: "Breads and Rice",
                menuId: menu._id,
              },
            ];
          } else if (meal === "Dinner") {
            foodData = [
              { name: "Mutton Biryani", type: "Dish", menuId: menu._id },
              { name: "Veg Pulao", type: "Breads and Rice", menuId: menu._id },
              { name: "Gulab Jamun", type: "Others", menuId: menu._id },
            ];
          }

          // Save the items
          const insertedItems = await MenuItem.insertMany(foodData);

          // C) Update the Menu Container
          menu.items = insertedItems.map((item) => item._id);
          await menu.save();
        }
      }
    }

    // 3. CREATE USERS & ALLOCATIONS
    console.log("Registering Users & Allocations...");

    // User 1: Real Login
    await UserAllocHostel.create({
      rollno: REAL_ROLL_NUMBER,
      hostel: brahmaputra._id,
      current_subscribed_mess: brahmaputra._id,
    });

    // User 2: Fake User
    const friendRoll = "210000002";
    await UserAllocHostel.create({
      rollno: friendRoll,
      hostel: barak._id,
      current_subscribed_mess: barak._id,
    });

    await User.create({
      name: "Test Friend",
      rollNumber: friendRoll,
      email: "friend@iitg.ac.in",
      hostel: barak._id,
      curr_subscribed_mess: barak._id,
      roomNumber: "B-202",
      authProvider: "microsoft",
      hasMicrosoftLinked: true,
      role: "student",
    });

    console.log("\nFULL SEED COMPLETE!");
    console.log("-------------------------------------------------");
    console.log(`✅ Hostels & Messes Created: Brahmaputra & Barak`);
    console.log(`✅ Menus Created: Every meal, 7 days a week`);
    console.log(`✅ Whitelisted Roll Number: ${REAL_ROLL_NUMBER}`);
    console.log("-------------------------------------------------");
  } catch (err) {
    console.error("❌ Error seeding DB:", err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

seedDatabase();
