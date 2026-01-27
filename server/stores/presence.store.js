import { redisPub as r } from "../config/redis.js";

const key = (name) => `presence:user:${name}`;

export async function setOnline(name, socketId) {
  await r.set(key(name), socketId, { EX: 60 * 60 });
}

export async function getUserSocket(name) {
  return r.get(key(name));
}

export async function setOffline(name, socketId) {
  const current = await r.get(key(name));
  if (current === socketId) {
    await r.del(key(name));
  }
}