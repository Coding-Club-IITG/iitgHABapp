import admin from "firebase-admin";
import { readFileSync } from "fs";

function loadHqServiceAccount() {
  return JSON.parse(
    readFileSync(
      new URL(
        "../../../../server/modules/google_login/serviceAccountKey.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}

const APP_NAME = "habit-hq";

function getOrInitHqAdminApp() {
  const existing = admin.apps.find((a) => a?.name === APP_NAME);
  if (existing) return existing;

  const serviceAccount = loadHqServiceAccount();
  return admin.initializeApp(
    { credential: admin.credential.cert(serviceAccount) },
    APP_NAME,
  );
}

export function getHqAuth() {
  return getOrInitHqAdminApp().auth();
}

