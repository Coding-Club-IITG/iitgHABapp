import path from "path";
import dotenv from "dotenv";
const __dirname = import.meta.dirname;
dotenv.config({ path: path.join(__dirname, "../.env") });

// Configuration
const MONGO_URI = process.env.MONGODB_URI;

const migrate = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to DB...");

  // Define simple schemas just to read/write raw data
  // 'strict: false' ensures we grab every single field
  const OldUser = mongoose.model(
    "OldUser",
    new mongoose.Schema({}, { strict: false }),
    "users",
  );
  const NewUser = mongoose.model(
    "NewUser",
    new mongoose.Schema({}, { strict: false }),
    "users_v2",
  );

  // 1. Fetch all old users
  const users = await OldUser.find({});
  console.log(`Found ${users.length} users to migrate.`);

  // 2. Insert into new collection
  if (users.length > 0) {
    // Transform data if needed (e.g., add default profilePic)
    const transformedUsers = users.map((u) => {
      const userObj = u.toObject();
      delete userObj._id; // Optional: delete ID to let Mongo generate new ones, OR keep it to preserve links

      // Example: Initialize the new V1 field
      userObj.profilePic = userObj.profilePic || "default.png";

      return userObj;
    });

    try {
      await NewUser.insertMany(transformedUsers);
      console.log("Migration Successful! Data copied to 'users_v2'");
    } catch (e) {
      console.error("Migration Failed:", e);
    }
  }

  mongoose.connection.close();
};

migrate();
