/**
 * User.curr_subscribed_mess points at a Hostel (mess location).
 * Caterer name lives on Mess (hostel.messId → Mess.name).
 */
export const populateCurrSubscribedMess = {
  path: "curr_subscribed_mess",
  select: "hostel_name messId",
  populate: { path: "messId", select: "name" },
};

export function subscribedMessDisplayName(subscribedHostelDoc) {
  if (!subscribedHostelDoc) return null;
  const mess = subscribedHostelDoc.messId;
  const caterer =
    mess && typeof mess === "object" && mess.name ? mess.name : null;
  return caterer || subscribedHostelDoc.hostel_name || null;
}
