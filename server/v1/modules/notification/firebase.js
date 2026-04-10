const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(
  path.join(__dirname, "../../../modules/notification/serviceAccountKey.json"),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
