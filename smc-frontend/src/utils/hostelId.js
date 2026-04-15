/**
 * GET /users/ returns `hostel` populated as `{ _id, hostel_name }`.
 * Paths and APIs that expect a Hostel ObjectId need the raw id.
 */
export function getHostelId(user) {
  if (!user?.hostel) return null;
  const h = user.hostel;
  if (typeof h === "object" && h !== null && h._id != null) {
    return h._id;
  }
  return h;
}
