import { io } from "socket.io-client";

const URL = import.meta.env.VITE_SOCKET_URL;

// ✅ HMR-safe singleton (no duplicate sockets)
const globalKey = "__VOICE_SOCKET__";

export const socket =
  globalThis[globalKey] ||
  (globalThis[globalKey] = io(URL, {
    autoConnect: true,
    withCredentials: true,

    // ✅ allow fallback + upgrade (prevents "transport close" loops)
    transports: ["polling", "websocket"],

    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 300,
  }));

// Optional debug (helps)
socket.on("connect", () => console.log("✅ client socket connected:", socket.id));
socket.on("disconnect", (r) => console.log("❌ client socket disconnected:", r));