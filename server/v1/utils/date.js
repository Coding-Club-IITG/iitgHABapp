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
