import http from "http";
import { createApp } from "./app.js";
import { ENV } from "./config/env.js";
import { connectRedis } from "./config/redis.js";
import { initSocket } from "./socket/socket.js";

const app = createApp();
const server = http.createServer(app);

await connectRedis();
initSocket(server);

server.listen(ENV.PORT, () => {
  console.log(`✅ Server running on http://localhost:${ENV.PORT}`);
});