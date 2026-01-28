import { addChat, getChatHistory } from "../../services/chat.service.js";
import { toggleReaction } from "../../services/reactions.service.js";

export function chatSocketController(io, socket) {
  // ====== CHAT HISTORY ======
  socket.on("chat:history", async () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    
    const history = await getChatHistory(roomId);
    socket.emit("chat:history", history);
  });

  // ====== SEND TEXT MESSAGE ======
  socket.on("chat:send", async ({ text }) => {
    const roomId = socket.data.roomId;
    const user = socket.data.user;
    if (!roomId) return;

    const clean = (text || "").trim();
    if (!clean) return;

    const msg = {
      id: `${Date.now()}-${Math.random()}`,
      roomId,
      type: "chat",
      text: clean,
      user: user?.name || "User",
      from: socket.id,
      createdAt: Date.now(),
    };

    await addChat(roomId, msg);
    io.to(roomId).emit("chat:message", msg);
  });

  // ====== SEND VOICE MESSAGE ======
  socket.on("chat:send:voice", async ({ audio, duration, mimeType }) => {
    const roomId = socket.data.roomId;
    const user = socket.data.user;
    
    if (!roomId) {
      console.error("chat:send:voice - no roomId");
      return;
    }
    
    if (!audio) {
      console.error("chat:send:voice - no audio data");
      return;
    }

    const msg = {
      id: `${Date.now()}-${Math.random()}`,
      roomId,
      type: "voice",
      audio,
      duration: duration || 0,
      mimeType: mimeType || "audio/webm",
      user: user?.name || "User",
      from: socket.id,
      createdAt: Date.now(),
    };

    await addChat(roomId, msg);
    io.to(roomId).emit("chat:message", msg);
  });

  // ====== REACTIONS ======
  socket.on("chat:react", async ({ messageId, emoji }) => {
    const roomId = socket.data.roomId;
    const user = socket.data.user?.name;
    
    if (!roomId || !user || !messageId || !emoji) return;

    await toggleReaction(roomId, messageId, emoji, user);

    // Emit singular "chat:reaction" to match frontend
    io.to(roomId).emit("chat:reaction", { 
      messageId, 
      emoji, 
      user 
    });
  });

  // ====== TYPING INDICATOR ======
  socket.on("chat:typing", ({ isTyping }) => {
    const roomId = socket.data.roomId;
    const user = socket.data.user?.name || "User";
    
    if (!roomId) return;

    socket.to(roomId).emit("chat:typing:status", {
      socketId: socket.id,
      user,
      isTyping: !!isTyping,
    });
  });
}