import { createClient } from "redis";

const client = createClient({ url: process.env.REDIS_URL });

client.on("error", (err) => console.error("Redis Socket Error:", err));

// 1. CATCH THE SILENT STARTUP CRASH
client.connect().catch((err) => {
  console.error("FATAL REDIS CONNECTION ERROR ON STARTUP:", err.message);
});

const storeLogs = async (logInfo) => {
  // 2. PREVENT THE INFINITE MEMORY TRAP
  if (!client.isReady) {
    console.error("Skipping Log: Redis Client is not connected!");
    return;
  }

  try {
    await client.lPush("logs_queue", JSON.stringify(logInfo));
  } catch (err) {
    console.error("Error storing logs in Redis:", err);
  }
};

export default storeLogs;
