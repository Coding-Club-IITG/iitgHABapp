import { RoomCleaningBooking } from "./roomCleaningBookingModel.js";

const IST_OFFSET_MINUTES = 5.5 * 60;

const getISTNow = () => {
  const now = new Date();
  const utcMillis = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMillis = utcMillis + IST_OFFSET_MINUTES * 60000;
  return new Date(istMillis);
};

const startOfDayIST = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

const endOfDayIST = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
};

function isBookingWindowOpen(bookingDate, now = getISTNow()) {
  const d = startOfDayIST(bookingDate);
  const openDay = new Date(d);
  openDay.setDate(openDay.getDate() - 3);
  const openTime = new Date(
    openDay.getFullYear(),
    openDay.getMonth(),
    openDay.getDate(),
    9,
    0,
    0,
    0,
  );
  const closeDay = new Date(d);
  closeDay.setDate(closeDay.getDate() - 2);
  const closeTime = endOfDayIST(closeDay);
  return now >= openTime && now <= closeTime;
}

export async function getRoomCleaningBookingsForUser(userId) {
  const bookings = await RoomCleaningBooking.find({ userId })
    .sort({ bookingDate: -1, createdAt: -1 })
    .select("_id bookingDate slot status hostelId feedbackId reason")
    .lean();

  const today = startOfDayIST(getISTNow());

  return bookings.map((booking) => {
    const bookingDate = startOfDayIST(booking.bookingDate);
    const future = bookingDate > today;
    const cancellableStatus =
      booking.status === "Booked" || booking.status === "Buffered";
    const windowOpen = future && isBookingWindowOpen(booking.bookingDate);

    return {
      ...booking,
      canCancel: cancellableStatus && future && windowOpen,
    };
  });
}

