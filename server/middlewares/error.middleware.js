import { logger } from "../utils/logger.js";

export function errorMiddleware(err, req, res, next) {
  logger.error(err?.message || err);
  res.status(500).json({
    error: "Internal Server Error",
    details: err?.message || "Unknown error",
  });
}