import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redisPub, redisSub } from "../config/redis.js";
import { ENV } from "../config/env.js";

import { roomSocketController } from "./controllers/room.socket.controller.js";
import { chatSocketController } from "./controllers/chat.socket.controller.js";
import { dmSocketController } from "./controllers/dm.socket.controller.js"; // ✅ add
import { presenceSocketController } from "./controllers/presence.socket.controller.js";
import { webrtcSocketController } from "./controllers/webrtc.socket.controller.js";

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: ENV.CLIENT_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.adapter(createAdapter(redisPub, redisSub));

  io.on("connection", (socket) => {
    roomSocketController(io, socket);
    chatSocketController(io, socket);
    dmSocketController(io, socket);          // ✅ add
    presenceSocketController(io, socket);
    webrtcSocketController(io, socket);
  });

  return io;
}