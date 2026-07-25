import path from "path";
import dotenv from "dotenv";
const __dirname = import.meta.dirname;
dotenv.config({ path: path.join(__dirname, "../../.env") });
import mongoose from "mongoose";
import bcrypt from "bcrypt";

import { Hostel } from "../modules/hostel/hostelModel.js";
import { Mess } from "../modules/mess/messModel.js";
import { User } from "../modules/user/userModel.js";
import UserAllocHostel from "../modules/hostel/hostelAllocModel.js";
import { Menu } from "../modules/mess/menuModel.js";
import { MenuItem } from "../modules/mess/menuItemModel.js";

// Login via Microsoft with REAL_ROLL_NUMBER after running script
const REAL_ROLL_NUMBER = process.env.REAL_ROLL_NUMBER || "210000001";
const MANAGER_GMAIL = (process.env.MANAGER_GMAIL || "codingclubiitg@gmail.com")
  .trim()
  .toLowerCase();
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD || "password123";

import { mongodbUri } from "../config/default.js";

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
    await mongoose.connect(mongodbUri);
    console.log("Connected successfully.\n");

    console.log("Clearing old data to prevent duplicates...");
    await Hostel.deleteMany({});
    await Mess.deleteMany({});
    await User.deleteMany({});
    await UserAllocHostel.deleteMany({});
    await Menu.deleteMany({});
    await MenuItem.deleteMany({});

    // 1. CREATE HOSTELS & MESSES WITH MANAGER CREDENTIALS
    console.log("Creating Hostels and Messes...");

    const hashedPassword = await bcrypt.hash(MANAGER_PASSWORD, 10);

    const brahmaputra = await Hostel.create({
      hostel_name: "Brahmaputra",
      microsoft_email: "brahmaputra_manager@iitg.ac.in",
      secretary_email: "brahmaputra_secy@iitg.ac.in",
      curr_cap: 0,
      managerPasswordHash: hashedPassword,
    });

    const barak = await Hostel.create({
      hostel_name: "Barak",
      microsoft_email: "barak_manager@iitg.ac.in",
      secretary_email: "barak_secy@iitg.ac.in",
      curr_cap: 0,
      managerPasswordHash: hashedPassword,
    });

    const brahmaputraMess = await Mess.create({
      name: "Brahmaputra Mess",
      hostelId: brahmaputra._id,
      managerGoogleEmail: MANAGER_GMAIL,
    });

    const barakMess = await Mess.create({
      name: "Barak Mess",
      hostelId: barak._id,
      managerGoogleEmail: "barak_caterer@iitg.ac.in",
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
    console.log("------------------------------------------------------------");
    console.log(`✅ Hostels & Messes Created: Brahmaputra & Barak`);
    console.log(`✅ Menus Created: Every meal, 7 days a week`);
    console.log(`✅ Whitelisted Roll Number: ${REAL_ROLL_NUMBER}`);
    console.log(`✅ Mess Manager (HQ) Google Email: ${MANAGER_GMAIL}`);
    console.log(`✅ Room Cleaning (RC) Manager Password: ${MANAGER_PASSWORD}`);
    console.log("------------------------------------------------------------");
  } catch (err) {
    console.error("❌ Error seeding DB:", err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

seedDatabase();
