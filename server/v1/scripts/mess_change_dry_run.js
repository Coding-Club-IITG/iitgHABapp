const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const ROOT_DIR = path.resolve(__dirname, "../../..");
const SERVER_DIR = path.join(ROOT_DIR, "server");
const SERVER_V1_DIR = path.join(SERVER_DIR, "v1");

dotenv.config({ path: path.resolve(SERVER_DIR, ".env") });

const { User } = require("../modules/user/userModel.js");
const { Hostel } = require("../modules/hostel/hostelModel.js");
const UserAllocHostel = require("../modules/hostel/hostelAllocModel.js");

const SNAPSHOT_DIR = path.join(__dirname, "snapshots");
const OUTPUT_DIR = path.join(__dirname, "outputs");

const SNAPSHOT_FILES = {
  usersCandidatesBefore: path.join(
    SNAPSHOT_DIR,
    "users_candidates_before.json",
  ),
  hostelsBefore: path.join(SNAPSHOT_DIR, "hostels_master_before.json"),
  allocationBefore: path.join(SNAPSHOT_DIR, "hostel_allocation_before.json"),
  appliedRequestsBefore: path.join(
    SNAPSHOT_DIR,
    "applied_requests_before.json",
  ),
};

const OUTPUT_FILES = {
  usersAfter: path.join(OUTPUT_DIR, "users_candidates_after.json"),
  allocationAfter: path.join(OUTPUT_DIR, "hostel_allocation_after.json"),
  capacityBefore: path.join(OUTPUT_DIR, "capacity_before.csv"),
  capacityAfter: path.join(OUTPUT_DIR, "capacity_after.csv"),
  capacityBeforeJson: path.join(OUTPUT_DIR, "capacity_before.json"),
  capacityAfterJson: path.join(OUTPUT_DIR, "capacity_after.json"),
  decisionsCsv: path.join(OUTPUT_DIR, "decisions_sorted.csv"),
  decisionsJson: path.join(OUTPUT_DIR, "decisions_sorted.json"),
  acceptedJson: path.join(OUTPUT_DIR, "accepted_users.json"),
  rejectedJson: path.join(OUTPUT_DIR, "rejected_users.json"),
  summary: path.join(OUTPUT_DIR, "dry_run_summary.json"),
};

const toId = (value) => (value ? String(value) : null);
const toIso = (value) => (value ? new Date(value).toISOString() : null);
const normalizeRoll = (value) =>
  value === null || value === undefined
    ? ""
    : String(value).trim().toUpperCase();

const ensureDirs = () => {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const escapeCsv = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const writeCsv = (filePath, rows) => {
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  fs.writeFileSync(filePath, csv);
};

const getCaps = (currCap) => {
  const maxCapacity = Number(currCap || 200);
  let upperMultiplier = 1.2;
  if (maxCapacity > 1000) upperMultiplier = 1.05;
  else if (maxCapacity === 1000) upperMultiplier = 1.1;
  else if (maxCapacity >= 400) upperMultiplier = 1.15;
  const upperCap = Math.floor(maxCapacity * upperMultiplier);
  const lowerCap = Math.floor(maxCapacity * 0.9);
  return { maxCapacity, upperMultiplier, upperCap, lowerCap };
};

const sortByTimestamp = (a, b) => {
  const ta = a.applied_hostel_timestamp
    ? new Date(a.applied_hostel_timestamp).getTime()
    : Number.MAX_SAFE_INTEGER;
  const tb = b.applied_hostel_timestamp
    ? new Date(b.applied_hostel_timestamp).getTime()
    : Number.MAX_SAFE_INTEGER;
  if (ta !== tb) return ta - tb;
  return String(a._id).localeCompare(String(b._id));
};

const buildCapacityTableFromAllocation = (hostels, allocationRows) => {
  const boardersCount = new Map();
  const subscribersCount = new Map();

  for (const row of allocationRows) {
    const hostelId = toId(row.hostel);
    const messId = toId(row.current_subscribed_mess);
    if (hostelId)
      boardersCount.set(hostelId, (boardersCount.get(hostelId) || 0) + 1);
    if (messId)
      subscribersCount.set(messId, (subscribersCount.get(messId) || 0) + 1);
  }

  return hostels
    .map((hostel) => {
      const hostelId = toId(hostel._id);
      const caps = getCaps(hostel.curr_cap);
      const boarders = boardersCount.get(hostelId) || 0;
      const messSubscribers = subscribersCount.get(hostelId) || 0;
      return {
        hostelId,
        hostelName: hostel.hostel_name || "Unknown",
        maxCapacity: caps.maxCapacity,
        upperMultiplier: caps.upperMultiplier,
        upperCap: caps.upperCap,
        lowerCap: caps.lowerCap,
        boarders,
        messSubscribers,
        availableToUpperCap: caps.upperCap - messSubscribers,
      };
    })
    .sort((a, b) => a.hostelName.localeCompare(b.hostelName));
};

const createSnapshots = async () => {
  const [usersAll, hostelsAll, allocationAll] = await Promise.all([
    User.find({}).lean(),
    Hostel.find({}).lean(),
    UserAllocHostel.find({}).lean(),
  ]);

  const usersCandidates = usersAll.filter((user) => {
    const hostelId = toId(user.hostel);
    const messId = toId(user.curr_subscribed_mess);
    return (
      Boolean(user.applied_for_mess_changed) ||
      (hostelId && messId && hostelId !== messId)
    );
  });

  const appliedRequests = usersAll
    .filter((user) => Boolean(user.applied_for_mess_changed))
    .sort(sortByTimestamp);

  const allocationNormalized = allocationAll.map((row) => ({
    ...row,
    _id: toId(row._id),
    hostel: toId(row.hostel),
    current_subscribed_mess: toId(row.current_subscribed_mess),
  }));

  writeJson(SNAPSHOT_FILES.usersCandidatesBefore, usersCandidates);
  writeJson(SNAPSHOT_FILES.hostelsBefore, hostelsAll);
  writeJson(SNAPSHOT_FILES.allocationBefore, allocationNormalized);
  writeJson(SNAPSHOT_FILES.appliedRequestsBefore, appliedRequests);

  return {
    usersCandidatesCount: usersCandidates.length,
    appliedRequestsCount: appliedRequests.length,
    hostelsCount: hostelsAll.length,
    allocationRowsCount: allocationNormalized.length,
  };
};

const runSimulationFromSnapshots = () => {
  const usersCandidatesBefore = readJson(SNAPSHOT_FILES.usersCandidatesBefore);
  const hostelsBefore = readJson(SNAPSHOT_FILES.hostelsBefore);
  const allocationBefore = readJson(SNAPSHOT_FILES.allocationBefore);
  const appliedRequestsBefore = readJson(SNAPSHOT_FILES.appliedRequestsBefore);

  const hostelById = new Map(
    hostelsBefore.map((hostel) => [toId(hostel._id), hostel]),
  );

  const usersAfter = usersCandidatesBefore.map((user) => ({ ...user }));
  const usersAfterMap = new Map(
    usersAfter.map((user) => [toId(user._id), user]),
  );
  const usersAfterByRoll = new Map(
    usersAfter
      .filter((user) => user.rollNumber)
      .map((user) => [normalizeRoll(user.rollNumber), user]),
  );

  const allocationAfterReset = allocationBefore.map((row) => ({
    ...row,
    current_subscribed_mess: row.hostel || null,
  }));

  for (const row of allocationAfterReset) {
    const user = usersAfterByRoll.get(normalizeRoll(row.rollno));
    if (!user) continue;
    user.curr_subscribed_mess = row.hostel;
    user.got_mess_changed = false;
  }

  const capacityBefore = buildCapacityTableFromAllocation(
    hostelsBefore,
    allocationAfterReset,
  );

  const capacityTracker = {};
  for (const row of capacityBefore) {
    capacityTracker[row.hostelId] = {
      current: row.messSubscribers,
      available: row.upperCap - row.messSubscribers,
      lowerCap: row.lowerCap,
    };
  }

  const queue = [...appliedRequestsBefore].sort(sortByTimestamp);
  const state = new Map();

  for (const user of queue) {
    const hostelId = toId(user.hostel);
    state.set(toId(user._id), {
      id: toId(user._id),
      name: user.name,
      rollNumber: user.rollNumber,
      applied_hostel_timestamp: user.applied_hostel_timestamp || null,
      hostelId,
      currentMess: hostelId,
      prefs: [
        toId(user.next_mess1),
        toId(user.next_mess2),
        toId(user.next_mess3),
      ],
      resolved: false,
    });
  }

  const acceptedUsers = [];

  while (true) {
    let moved = false;

    for (const user of queue) {
      const st = state.get(toId(user._id));
      if (!st || st.resolved) continue;

      let target = null;
      for (const pref of st.prefs) {
        if (
          pref &&
          capacityTracker[pref] &&
          capacityTracker[pref].available > 0
        ) {
          target = pref;
          break;
        }
      }
      if (!target) continue;

      const from = st.currentMess;
      const fromTracker = from ? capacityTracker[from] : null;

      if (fromTracker && fromTracker.current - 1 < fromTracker.lowerCap) {
        continue;
      }

      capacityTracker[target].available -= 1;
      capacityTracker[target].current += 1;

      if (fromTracker) {
        fromTracker.available += 1;
        fromTracker.current -= 1;
      }

      st.currentMess = target;
      st.resolved = true;

      acceptedUsers.push({
        id: st.id,
        name: st.name,
        rollNumber: st.rollNumber,
        fromHostelId: from,
        toHostelId: target,
        hostelId: st.hostelId,
        applied_hostel_timestamp: st.applied_hostel_timestamp,
        pref1: st.prefs[0],
        pref2: st.prefs[1],
        pref3: st.prefs[2],
      });

      moved = true;
      break;
    }

    if (!moved) break;
  }

  const acceptedIdSet = new Set(acceptedUsers.map((user) => user.id));
  const rejectedUsers = queue
    .filter((user) => !acceptedIdSet.has(toId(user._id)))
    .map((user) => ({
      id: toId(user._id),
      name: user.name,
      rollNumber: user.rollNumber,
      fromHostelId: toId(user.hostel),
      toHostelId: null,
      hostelId: toId(user.hostel),
      applied_hostel_timestamp: user.applied_hostel_timestamp || null,
      pref1: toId(user.next_mess1),
      pref2: toId(user.next_mess2),
      pref3: toId(user.next_mess3),
    }));

  for (const accepted of acceptedUsers) {
    const user = usersAfterMap.get(accepted.id);
    if (!user) continue;

    user.curr_subscribed_mess = accepted.toHostelId;
    user.applied_for_mess_changed = false;
    user.got_mess_changed = true;
    user.applied_hostel_string = "";
    user.next_mess1 = null;
    user.next_mess2 = null;
    user.next_mess3 = null;
    user.applied_hostel_timestamp = null;
  }

  for (const rejected of rejectedUsers) {
    const user = usersAfterMap.get(rejected.id);
    if (!user) continue;

    user.applied_for_mess_changed = false;
    user.applied_hostel_string = "";
    user.next_mess1 = null;
    user.next_mess2 = null;
    user.next_mess3 = null;
    user.got_mess_changed = false;
  }

  const allocationAfterMap = new Map(
    allocationAfterReset.map((row) => [normalizeRoll(row.rollno), { ...row }]),
  );

  for (const accepted of acceptedUsers) {
    const key = normalizeRoll(accepted.rollNumber);
    const row = allocationAfterMap.get(key);
    if (row) row.current_subscribed_mess = accepted.toHostelId;
  }

  for (const rejected of rejectedUsers) {
    const key = normalizeRoll(rejected.rollNumber);
    const row = allocationAfterMap.get(key);
    if (row) row.current_subscribed_mess = row.hostel;
  }

  const allocationAfter = Array.from(allocationAfterMap.values());
  const capacityAfter = buildCapacityTableFromAllocation(
    hostelsBefore,
    allocationAfter,
  );

  const decisions = [
    ...acceptedUsers.map((user) => ({
      status: "ACCEPTED",
      userId: user.id,
      name: user.name || "",
      rollNumber: user.rollNumber || "",
      appliedAt: toIso(user.applied_hostel_timestamp),
      currentHostelId: user.hostelId,
      currentHostelName:
        hostelById.get(user.hostelId)?.hostel_name || "Unknown",
      currentMessBeforeId: user.fromHostelId,
      currentMessBeforeName:
        hostelById.get(user.fromHostelId)?.hostel_name || "Unknown",
      preference1Id: user.pref1,
      preference1Name: hostelById.get(user.pref1)?.hostel_name || null,
      preference2Id: user.pref2,
      preference2Name: hostelById.get(user.pref2)?.hostel_name || null,
      preference3Id: user.pref3,
      preference3Name: hostelById.get(user.pref3)?.hostel_name || null,
      allottedMessId: user.toHostelId,
      allottedMessName:
        hostelById.get(user.toHostelId)?.hostel_name || "Unknown",
    })),
    ...rejectedUsers.map((user) => ({
      status: "REJECTED",
      userId: user.id,
      name: user.name || "",
      rollNumber: user.rollNumber || "",
      appliedAt: toIso(user.applied_hostel_timestamp),
      currentHostelId: user.hostelId,
      currentHostelName:
        hostelById.get(user.hostelId)?.hostel_name || "Unknown",
      currentMessBeforeId: user.fromHostelId,
      currentMessBeforeName:
        hostelById.get(user.fromHostelId)?.hostel_name || "Unknown",
      preference1Id: user.pref1,
      preference1Name: hostelById.get(user.pref1)?.hostel_name || null,
      preference2Id: user.pref2,
      preference2Name: hostelById.get(user.pref2)?.hostel_name || null,
      preference3Id: user.pref3,
      preference3Name: hostelById.get(user.pref3)?.hostel_name || null,
      allottedMessId: null,
      allottedMessName: null,
    })),
  ].sort((a, b) => {
    const ta = a.appliedAt
      ? new Date(a.appliedAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    const tb = b.appliedAt
      ? new Date(b.appliedAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return String(a.userId).localeCompare(String(b.userId));
  });

  writeJson(OUTPUT_FILES.usersAfter, usersAfter);
  writeJson(OUTPUT_FILES.allocationAfter, allocationAfter);
  writeJson(OUTPUT_FILES.capacityBeforeJson, capacityBefore);
  writeJson(OUTPUT_FILES.capacityAfterJson, capacityAfter);
  writeJson(OUTPUT_FILES.decisionsJson, decisions);
  writeJson(OUTPUT_FILES.acceptedJson, acceptedUsers);
  writeJson(OUTPUT_FILES.rejectedJson, rejectedUsers);

  writeCsv(OUTPUT_FILES.capacityBefore, [
    [
      "hostel_id",
      "hostel_name",
      "boarders",
      "mess_subscribers",
      "max_capacity",
      "upper_cap",
      "lower_cap",
      "available_to_upper_cap",
    ],
    ...capacityBefore.map((row) => [
      row.hostelId,
      row.hostelName,
      row.boarders,
      row.messSubscribers,
      row.maxCapacity,
      row.upperCap,
      row.lowerCap,
      row.availableToUpperCap,
    ]),
  ]);

  writeCsv(OUTPUT_FILES.capacityAfter, [
    [
      "hostel_id",
      "hostel_name",
      "boarders",
      "mess_subscribers",
      "max_capacity",
      "upper_cap",
      "lower_cap",
      "available_to_upper_cap",
    ],
    ...capacityAfter.map((row) => [
      row.hostelId,
      row.hostelName,
      row.boarders,
      row.messSubscribers,
      row.maxCapacity,
      row.upperCap,
      row.lowerCap,
      row.availableToUpperCap,
    ]),
  ]);

  writeCsv(OUTPUT_FILES.decisionsCsv, [
    [
      "status",
      "applied_at",
      "name",
      "roll_number",
      "current_hostel",
      "current_mess_before",
      "preference_1",
      "preference_2",
      "preference_3",
      "allotted_mess",
    ],
    ...decisions.map((row) => [
      row.status,
      row.appliedAt || "",
      row.name,
      row.rollNumber,
      row.currentHostelName,
      row.currentMessBeforeName,
      row.preference1Name || "",
      row.preference2Name || "",
      row.preference3Name || "",
      row.allottedMessName || "",
    ]),
  ]);

  return {
    acceptedCount: acceptedUsers.length,
    rejectedCount: rejectedUsers.length,
    decisionsCount: decisions.length,
  };
};

const main = async () => {
  ensureDirs();

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Check server/.env");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const snapshotInfo = await createSnapshots();
    const resultInfo = runSimulationFromSnapshots();

    const summary = {
      generatedAt: new Date().toISOString(),
      rootDir: __dirname,
      snapshotDir: SNAPSHOT_DIR,
      outputDir: OUTPUT_DIR,
      logicSource:
        "server/v1/modules/mess_change/controllers/processingController.js",
      counts: {
        ...snapshotInfo,
        ...resultInfo,
      },
      snapshots: SNAPSHOT_FILES,
      outputs: OUTPUT_FILES,
    };

    writeJson(OUTPUT_FILES.summary, summary);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
