import { ENV } from "./env.js";

export const corsOptions = {
  origin: ENV.CLIENT_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
};