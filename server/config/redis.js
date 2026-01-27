import { createClient } from "redis";
import { ENV } from "./env.js";

export const redisPub = createClient({ url: ENV.REDIS_URL });
export const redisSub = redisPub.duplicate();

export async function connectRedis() {
  if (!redisPub.isOpen) await redisPub.connect();
  if (!redisSub.isOpen) await redisSub.connect();
  console.log("✅ Redis connected");
}