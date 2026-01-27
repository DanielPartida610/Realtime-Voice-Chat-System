import { redisPub as r } from "../config/redis.js";

const key = (roomId) => `room:${roomId}:reactions`; 
// field = messageId, value = json map { "🔥": ["naina","khushi"] }

export async function getReactions(roomId) {
  const raw = await r.get(key(roomId));
  return raw ? JSON.parse(raw) : {};
}

export async function setReactions(roomId, reactionsMap) {
  await r.set(key(roomId), JSON.stringify(reactionsMap), { EX: 60 * 60 * 24 * 7 });
}