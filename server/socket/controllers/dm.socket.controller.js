import { getDMHistory, pushDM } from "../../stores/dm.store.js";
import { getUserSocket } from "../../stores/presence.store.js";
import { toggleReaction } from "../../services/reactions.service.js";

const makeDMId = (a, b) => {
  const [x, y] = [a, b].sort((m, n) => (m > n ? 1 : -1));
  return `${x}:${y}`;
};

export function dmSocketController(io, socket) {
  // ====== DM HISTORY ======
  socket.on("dm:history", async ({ toUser }) => {
    const fromUser = socket.data.user?.name;
    
    if (!fromUser || !toUser) return;

    const dmId = makeDMId(fromUser, toUser);
    const history = await getDMHistory(dmId);
    
    socket.emit("dm:history", { dmId, history });
  });

  // ====== SEND TEXT DM ======
  socket.on("dm:send", async ({ toUser, text }) => {
    const fromUser = socket.data.user?.name;
    
    if (!fromUser || !toUser) return;

    const clean = (text || "").trim();
    if (!clean) return;

    const dmId = makeDMId(fromUser, toUser);

    const msg = {
      id: `${Date.now()}-${Math.random()}`,
      dmId,
      type: "chat",
      text: clean,
      user: fromUser,
      to: toUser,
      createdAt: Date.now(),
    };

    await pushDM(dmId, msg);

    // Send to sender
    socket.emit("dm:message", msg);

    // Send to receiver if online
    const toSocketId = await getUserSocket(toUser);
    if (toSocketId) {
      io.to(toSocketId).emit("dm:message", msg);
    }
  });

  // ====== SEND VOICE DM ======
  socket.on("dm:send:voice", async ({ toUser, audio, duration, mimeType }) => {
    const fromUser = socket.data.user?.name;
    
    if (!fromUser || !toUser) {
      console.error("dm:send:voice - missing fromUser or toUser");
      return;
    }
    
    if (!audio) {
      console.error("dm:send:voice - no audio data");
      return;
    }

    const dmId = makeDMId(fromUser, toUser);

    const msg = {
      id: `${Date.now()}-${Math.random()}`,
      dmId,
      type: "voice",
      audio,
      duration: duration || 0,
      mimeType: mimeType || "audio/webm",
      user: fromUser,
      to: toUser,
      createdAt: Date.now(),
    };

    await pushDM(dmId, msg);

    // Send to sender
    socket.emit("dm:message", msg);

    // Send to receiver if online
    const toSocketId = await getUserSocket(toUser);
    if (toSocketId) {
      io.to(toSocketId).emit("dm:message", msg);
    }
  });

  // ====== DM REACTIONS ======
  socket.on("dm:react", async ({ toUser, messageId, emoji }) => {
    const fromUser = socket.data.user?.name;
    
    if (!fromUser || !toUser || !messageId || !emoji) return;

    const dmId = makeDMId(fromUser, toUser);
    
    await toggleReaction(dmId, messageId, emoji, fromUser);

    // Send to both users
    socket.emit("dm:reaction", { messageId, emoji, user: fromUser });
    
    const toSocketId = await getUserSocket(toUser);
    if (toSocketId) {
      io.to(toSocketId).emit("dm:reaction", { messageId, emoji, user: fromUser });
    }
  });
}