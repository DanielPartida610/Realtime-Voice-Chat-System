import { redisPub as r } from "../config/redis.js";

const roomUsersKey = (roomId) => `room:${roomId}:users`;
const activeRoomsKey = () => `rooms:active`; // zset: score=lastActive timestamp

export async function addUser(roomId, socketId, user) {
  await r.hSet(roomUsersKey(roomId), socketId, JSON.stringify(user));
  await r.expire(roomUsersKey(roomId), 60 * 60);
  await touchRoom(roomId);
}

export async function removeUser(roomId, socketId) {
  await r.hDel(roomUsersKey(roomId), socketId);
  await touchRoom(roomId);
}

export async function getUsers(roomId) {
  const map = await r.hGetAll(roomUsersKey(roomId));
  return Object.entries(map).map(([sid, u]) => ({
    socketId: sid,
    user: JSON.parse(u),
  }));
}

export async function touchRoom(roomId) {
  const now = Date.now();
  await r.zAdd(activeRoomsKey(), [{ score: now, value: roomId }]);

  // cleanup older than 24h
  const dayAgo = now - 24 * 60 * 60 * 1000;
  await r.zRemRangeByScore(activeRoomsKey(), 0, dayAgo);
}

export async function listActiveRooms() {
  return r.zRange(activeRoomsKey(), 0, 50, { REV: true });
}