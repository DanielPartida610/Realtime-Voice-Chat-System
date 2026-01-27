import { redisPub as r } from "../config/redis.js";

const key = (roomId) => `room:${roomId}:chat`;

export async function pushMessage(roomId, message) {
  await r.lPush(key(roomId), JSON.stringify(message));
  await r.lTrim(key(roomId), 0, 49);
  await r.expire(key(roomId), 60 * 60 * 24);
}

export async function getHistory(roomId) {
  const items = await r.lRange(key(roomId), 0, 49);
  return items.map((x) => JSON.parse(x)).reverse();
}