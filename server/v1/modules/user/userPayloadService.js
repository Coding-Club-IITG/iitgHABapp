import { User } from "./userModel.js";

import {
  populateCurrSubscribedMess,
  subscribedMessDisplayName,
} from "../../utils/subscribedMessDisplay.js";

export async function getUserPayload(userId) {
  const u = await User.findById(userId)
    .populate("hostel", "hostel_name")
    .populate(populateCurrSubscribedMess)
    .lean();

  if (!u) return null;

  return {
    ...u,
    hostel_name: u.hostel?.hostel_name ?? null,
    curr_subscribed_mess_name: subscribedMessDisplayName(u.curr_subscribed_mess),
  };
}

