export const getCurrentDate = () => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
};

export const getCurrentTime = () => {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }); // HH:mm
};

export const getCurrentDay = () => {
  return new Date().toLocaleString("en-US", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  });
};

const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getIstYmdFromUtcDate(date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

export function getIstDayBounds(dateInput = new Date()) {
  const date =
    dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput);
  const { year, month, day } = getIstYmdFromUtcDate(date);
  const startMs = Date.UTC(year, month, day) - IST_OFFSET_MS;
  return {
    start: new Date(startMs),
    end: new Date(startMs + DAY_MS - 1),
  };
}

export function getIstStartOfToday() {
  return getIstDayBounds(new Date()).start;
}
