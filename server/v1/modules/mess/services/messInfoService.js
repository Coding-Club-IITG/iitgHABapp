import redisClient from "../../../utils/redisClient.js";

import { Hostel } from "../../hostel/hostelModel.js";
import { Mess } from "../messModel.js";

function roundToTwoDecimals(n) {
  if (n == null || n === "") return 0;
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.round(v * 100) / 100;
}

export async function getUserMessInfoBySubscribedHostel(subscribedHostelId) {
  if (!subscribedHostelId) return null;

  const messHostel = await Hostel.findById(subscribedHostelId)
    .select("messId")
    .lean();
  if (!messHostel?.messId) return null;

  const messInfo = await Mess.findById(messHostel.messId).lean();
  if (!messInfo) return null;

  return {
    ...messInfo,
    rating: messInfo.rating != null ? roundToTwoDecimals(messInfo.rating) : 0,
    ranking: messInfo.ranking != null ? Math.round(messInfo.ranking) : 0,
    feedbackPercentage:
      messInfo.feedbackPercentage != null
        ? roundToTwoDecimals(messInfo.feedbackPercentage)
        : 0,
  };
}

export async function getAllMessInfo({ useCache = true } = {}) {
  if (useCache) {
    const cachedData = await redisClient.get("all_mess_info");
    if (cachedData) return JSON.parse(cachedData);
  }

  const data = await Mess.aggregate([
    {
      $lookup: {
        from: "hostels",
        localField: "hostelId",
        foreignField: "_id",
        as: "hostelInfo",
      },
    },
    {
      $lookup: {
        from: "users",
        let: { hId: "$hostelId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$curr_subscribed_mess", "$$hId"] } } },
          { $count: "count" },
        ],
        as: "subscribers",
      },
    },
    {
      $addFields: {
        hostelName: {
          $ifNull: [{ $arrayElemAt: ["$hostelInfo.hostel_name", 0] }, null],
        },
        user_count: {
          $ifNull: [{ $arrayElemAt: ["$subscribers.count", 0] }, 0],
        },
        rating: {
          $round: [{ $ifNull: ["$rating", 0] }, 2],
        },
        ranking: {
          $round: [{ $ifNull: ["$ranking", 0] }, 0],
        },
        feedbackPercentage: {
          $round: [{ $ifNull: ["$feedbackPercentage", 0] }, 2],
        },
      },
    },
    {
      $project: {
        hostelInfo: 0,
        subscribers: 0,
      },
    },
  ]);

  if (useCache) {
    await redisClient.set("all_mess_info", JSON.stringify(data), "EX", 300);
  }

  return data;
}

