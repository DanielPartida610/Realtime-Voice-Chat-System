import { redisPub as r } from "../config/redis.js";

const key = (dmId) => `dm:${dmId}:messages`;

export async function pushDM(dmId, message) {
  await r.lPush(key(dmId), JSON.stringify(message));
  await r.lTrim(key(dmId), 0, 99);        // keep last 100 messages
  await r.expire(key(dmId), 60 * 60 * 24 * 7); // 7 days
}

export async function getDMHistory(dmId) {
  const items = await r.lRange(key(dmId), 0, 99);
  return items.map((x) => JSON.parse(x)).reverse();
}