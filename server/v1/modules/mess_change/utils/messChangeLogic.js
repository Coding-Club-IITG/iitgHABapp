const UserAllocHostel = require("../../hostel/hostelAllocModel.js");

/**
 * Initialize capacity tracker
 */
const initializeCapacityTracker = async (hostels) => {
  const capacityTracker = {};

  const subscriberRows = await UserAllocHostel.aggregate([
    {
      $match: {
        current_subscribed_mess: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$current_subscribed_mess",
        count: { $sum: 1 },
      },
    },
  ]);

  const subscriberByHostel = new Map(
    subscriberRows.map((row) => [String(row._id), row.count]),
  );

  for (const hostel of hostels) {
    const current = subscriberByHostel.get(hostel._id.toString()) || 0;

    const maxCap = hostel.curr_cap || 200;
    let upperMultiplier = 1.2;
    if (maxCap > 1000) {
      upperMultiplier = 1.05;
    } else if (maxCap === 1000) {
      upperMultiplier = 1.1;
    } else if (maxCap >= 400) {
      upperMultiplier = 1.15;
    }

    const upperCap = Math.floor(upperMultiplier * maxCap);
    const lowerCap = Math.floor(0.9 * maxCap);

    capacityTracker[hostel._id.toString()] = {
      hostel_name: hostel.hostel_name,
      current,
      initial: current,
      available: upperCap - current,
      lowerCap,
      upperCap,
      finalCount: current,
    };
  }

  return capacityTracker;
};

/**
 * Sort users by FCFS priority
 */
const sortUsersByPriority = (users) =>
  users.sort((a, b) => a.applied_hostel_timestamp - b.applied_hostel_timestamp);

/**
 * Core FCFS processing
 * Returns accepted and rejected users.
 */
const processUsersInIterations = async (users, capacityTracker) => {
  const queue = sortUsersByPriority([...users]);
  const state = new Map();

  for (const u of queue) {
    const hostelId = u.hostel?.toString() || null;

    state.set(u._id.toString(), {
      id: u._id.toString(),
      name: u.name,
      rollNumber: u.rollNumber,
      hostelId,
      currentMess: hostelId,
      prefs: [
        u.next_mess1?.toString() || null,
        u.next_mess2?.toString() || null,
        u.next_mess3?.toString() || null,
      ],
      resolved: false,
    });
  }

  const acceptedUsers = [];

  while (true) {
    let moved = false;

    for (const user of queue) {
      const st = state.get(user._id.toString());
      if (!st || st.resolved) continue;

      let target = null;
      for (const pref of st.prefs) {
        if (pref && capacityTracker[pref]?.available > 0) {
          target = pref;
          break;
        }
      }
      if (!target) continue;

      const from = st.currentMess;
      const fromTracker = capacityTracker[from];

      if (fromTracker && fromTracker.current - 1 < fromTracker.lowerCap) {
        continue;
      }

      capacityTracker[target].available -= 1;
      capacityTracker[target].current += 1;
      if (capacityTracker[target].finalCount !== undefined) {
        capacityTracker[target].finalCount += 1;
      }

      if (fromTracker) {
        fromTracker.available += 1;
        fromTracker.current -= 1;
        if (fromTracker.finalCount !== undefined) {
          fromTracker.finalCount -= 1;
        }
      }

      st.currentMess = target;
      st.resolved = true;

      acceptedUsers.push({
        id: st.id,
        name: st.name,
        rollNumber: st.rollNumber,
        fromHostelId: from,
        toHostelId: target,
      });

      moved = true;
      break; // restart FCFS scan
    }

    if (!moved) break;
  }

  const rejectedUsers = queue
    .filter((u) => !state.get(u._id.toString())?.resolved)
    .map((u) => ({
      id: u._id,
      name: u.name,
      rollNumber: u.rollNumber,
      fromHostelId: state.get(u._id.toString())?.hostelId || u.hostel,
      toHostelId: null,
    }));

  return { acceptedUsers, rejectedUsers };
};

module.exports = {
  initializeCapacityTracker,
  sortUsersByPriority,
  processUsersInIterations,
};
