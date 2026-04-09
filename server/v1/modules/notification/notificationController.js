const admin = require("./firebase.js");
const FCMToken = require("./FCMToken.js");
const User = require("../user/userModel.js");
const { Hostel } = require("../hostel/hostelModel.js");

// Register (or update) FCM token for a user
const registerToken = async (req, res) => {
  try {
    if (!req.user)
      return res.status(403).json({ error: "Only users can register tokens" });

    const { fcmToken } = req.body;
    if (!fcmToken)
      return res.status(400).json({ error: "FCM token is required" });

    // Always subscribe to general notifications (available to all authenticated users)
    admin.messaging().subscribeToTopic(fcmToken, "All_Hostels");

    // Hostel/mess-specific subscriptions require Microsoft linking
    if (req.user.hasMicrosoftLinked && req.user.rollNumber) {
      try {
        const curr_sub_mess = req.user.curr_subscribed_mess;
        if (curr_sub_mess) {
          const curr_sub_mess_name = (
            await Hostel.findById(curr_sub_mess._id || curr_sub_mess)
          )["hostel_name"].replaceAll(" ", "_");

          // Get user's current hostel name for Boarders_Their_Hostel topic
          const userHostel = await Hostel.findById(req.user.hostel);
          const userHostelName = userHostel
            ? userHostel.hostel_name.replaceAll(" ", "_")
            : null;

          console.log("Subscribing to topics:", {
            curr_sub_mess_name,
            userHostelName,
          });

          // Subscribe based on user's CURRENT HOSTEL (where they live)
          if (userHostelName) {
            // For boarders of this hostel
            admin
              .messaging()
              .subscribeToTopic(fcmToken, `Boarders_${userHostelName}`);
          }

          // Subscribe based on user's SUBSCRIBED MESS (hostel where their mess is)
          admin
            .messaging()
            .subscribeToTopic(fcmToken, `Subscribers_${curr_sub_mess_name}`);

          // Legacy: Subscribe to the hostel name directly (for backward compatibility)
          admin.messaging().subscribeToTopic(fcmToken, curr_sub_mess_name);
        }
      } catch (err) {
        console.error("Error subscribing to hostel/mess topics:", err);
        // Continue even if subscription fails
      }
    }

    await FCMToken.findOneAndUpdate(
      { user: req.user._id },
      { token: fcmToken },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({ message: "FCM token registered" });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};

// Generalized broadcast function (Updated for Mixed Payloads & Native Channels)
async function sendNotificationMessage(
  title,
  body,
  topic,
  data = {},
  isAlert = false,
  channelId = "hab_general_alerts" // Added Native Channel support
) {
  const payloadData = { ...data };
  
  if (isAlert) {
    payloadData.alert = "true";
    payloadData.title = title;
    payloadData.body = body;
  }

  // Use Mixed Payload: 'notification' makes the phone buzz, 'data' drives the Flutter UI
  const message = {
    notification: { title, body },
    data: payloadData,
    topic: topic,
    android: {
      notification: {
        channelId: channelId // Connects to OS settings
      }
    }
  };

  console.log("Broadcasting message:", message);
  await admin.messaging().send(message);
}

// Send a notification directly to a specific user's FCM token
// Added channelId parameter for granular control
const sendNotificationToUser = async (userId, title, body, channelId = "hab_general_alerts") => {
  try {
    const tokenDoc = await FCMToken.findOne({ user: userId });
    if (!tokenDoc || !tokenDoc.token) return;
    
    const message = {
      token: tokenDoc.token,
      notification: { title, body },
      android: {
        notification: {
          channelId: channelId // Connects to OS settings
        }
      }
    };
    
    await admin.messaging().send(message);
  } catch (e) {
    console.error("Error sending user notification:", e);
  }
};

// REST API Endpoint: Send notification to all users of a topic
const sendNotification = async (req, res) => {
  try {
    // Admin can specify channelId via portal, or it defaults to general
    const { title, body, topic, isAlert, channelId } = req.body;
    await sendNotificationMessage(
      title, 
      body, 
      topic, 
      {}, 
      isAlert || false, 
      channelId || "hab_general_alerts"
    );
    res.status(200).json({ message: "Notification sent" });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};

// Send welcome notification to the authenticated user
// Called from frontend after FCM token registration
const sendWelcomeNotification = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(403).json({ error: "Authentication required" });
    }

    // Check if user already has FCM token registered
    const tokenDoc = await FCMToken.findOne({ user: req.user._id });
    if (!tokenDoc || !tokenDoc.token) {
      return res.status(400).json({
        error: "FCM token not registered yet. Please register token first.",
      });
    }

    // Send welcome notification (defaults to general channel)
    await sendNotificationToUser(
      req.user._id,
      "Welcome to HABit IITG",
      "Thanks for signing in to your go-to app for all your hostel and mess related updates.",
      "hab_general_alerts",
    );

    res.status(200).json({ message: "Welcome notification sent" });
  } catch (err) {
    console.error("Error sending welcome notification:", err);
    res.status(500).json({ error: "Failed to send welcome notification" });
  }
};

module.exports = {
  registerToken,
  sendNotification,
  sendNotificationMessage,
  sendNotificationToUser,
  sendWelcomeNotification,
};
