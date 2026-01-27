import { getDMHistory, pushDM } from "../../stores/dm.store.js";
import { getUserSocket } from "../../stores/presence.store.js";
import { toggleReaction } from "../../services/reactions.service.js";

const makeDMId = (a, b) => {
  const [x, y] = [a, b].sort((m, n) => (m > n ? 1 : -1));
  return `${x}:${y}`;
};

export function dmSocketController(io, socket) {
  socket.on("dm:history", async ({ toUser }) => {
    const fromUser = socket.data.user?.name;
    if (!fromUser || !toUser) return;

    const dmId = makeDMId(fromUser, toUser);
    const history = await getDMHistory(dmId);
    socket.emit("dm:history", { dmId, history });
  });

  socket.on("dm:send", async ({ toUser, text }) => {
    const fromUser = socket.data.user?.name;
    if (!fromUser || !toUser) return;

    const clean = (text || "").trim();
    if (!clean) return;

    const dmId = makeDMId(fromUser, toUser);

    const msg = {
      id: `${Date.now()}-${Math.random()}`,
      dmId,
      text: clean,
      user: fromUser,
      to: toUser,
      createdAt: Date.now(),
    };

    await pushDM(dmId, msg);

    // sender always receives
    socket.emit("dm:message", msg);

    // receiver only if online
    const toSocketId = await getUserSocket(toUser);
    if (toSocketId) io.to(toSocketId).emit("dm:message", msg);
  });

  // ✅ NEW: DM reactions
  socket.on("dm:react", async ({ toUser, messageId, emoji }) => {
    const fromUser = socket.data.user?.name;
    if (!fromUser || !toUser || !messageId || !emoji) return;

    const dmId = makeDMId(fromUser, toUser);
    
    await toggleReaction(dmId, messageId, emoji, fromUser);

    // ✅ Send to both users
    socket.emit("dm:reaction", { messageId, emoji, user: fromUser });
    
    const toSocketId = await getUserSocket(toUser);
    if (toSocketId) {
      io.to(toSocketId).emit("dm:reaction", { messageId, emoji, user: fromUser });
    }
  });
}