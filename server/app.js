import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { corsOptions } from "./config/cors.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

export function createApp() {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json());

  app.get("/", (req, res) => res.send("Voice server running ✅"));
  app.use("/api", routes);

  app.use(errorMiddleware);
  return app;
}