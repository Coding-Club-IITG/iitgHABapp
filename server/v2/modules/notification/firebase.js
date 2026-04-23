import admin from "firebase-admin";
import { readFileSync } from "fs";
const serviceAccount = JSON.parse(
  readFileSync(
    new URL(
      "../../../modules/notification/serviceAccountKey.json",
      import.meta.url,
    ),
  ),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
