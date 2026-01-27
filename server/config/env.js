import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT || 5000),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "*",
  REDIS_URL: process.env.REDIS_URL,
};

if (!ENV.REDIS_URL) throw new Error("❌ Missing REDIS_URL in .env");