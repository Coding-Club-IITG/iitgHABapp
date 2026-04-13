// Helper to get feedback window dates for a given month
// Server is already in IST timezone, so we use local time
export const getFeedbackWindowDates = (
  targetMonth = null,
  targetYear = null,
) => {
  const now = new Date();
  const year = targetYear !== null ? targetYear : now.getFullYear();
  const month = targetMonth !== null ? targetMonth : now.getMonth(); // 0-11

  let startDay, endDay;

  if (month === 1) {
    // February
    startDay = 23;
    endDay = 25;
  } else {
    // All other months
    startDay = 25;
    endDay = 27;
  }

  // Create dates in local time (IST)
  // Start: 9 AM IST
  const startDate = new Date(year, month, startDay, 9, 0, 0);
  // End: 23:59:59 IST (end of day)
  const endDate = new Date(year, month, endDay, 23, 59, 59);

  return { startDate, endDate, startDay, endDay };
};

// Helper to get mess change window dates for a given month
// Server is already in IST timezone, so we use local time
export const getMessChangeWindowDates = (
  targetMonth = null,
  targetYear = null,
) => {
  const now = new Date();
  const year = targetYear !== null ? targetYear : now.getFullYear();
  const month = targetMonth !== null ? targetMonth : now.getMonth(); // 0-11

  let startDay, endDay;

  if (month === 1) {
    // February
    startDay = 26;
    endDay = 28;
  } else {
    // All other months
    startDay = 28;
    endDay = 30;
  }

  // Create dates in local time (IST)
  // Start: 9 AM IST
  const startDate = new Date(year, month, startDay, 9, 0, 0);
  // End: 23:59:59 IST (end of day)
  const endDate = new Date(year, month, endDay, 23, 59, 59);

  return { startDate, endDate, startDay, endDay };
};

export const getOrdinalSuffix = (i) => {
  let j = i % 10,
    k = i % 100;
  if (j === 1 && k !== 11) {
    return i + "st";
  }
  if (j === 2 && k !== 12) {
    return i + "nd";
  }
  if (j === 3 && k !== 13) {
    return i + "rd";
  }
  return i + "th";
};
