import { redisPub as r } from "../config/redis.js";

const speakingKey = (roomId) => `room:${roomId}:speaking`; // set

export async function setSpeaking(roomId, socketId, isSpeaking) {
  if (!roomId) return;

  if (isSpeaking) {
    await r.sAdd(speakingKey(roomId), socketId);
    await r.expire(speakingKey(roomId), 10);
  } else {
    await r.sRem(speakingKey(roomId), socketId);
  }
}

export async function getSpeaking(roomId) {
  return r.sMembers(speakingKey(roomId));
}