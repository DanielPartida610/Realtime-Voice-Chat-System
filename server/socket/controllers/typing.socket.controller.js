import { EVENTS } from "../events.js";

export function typingSocketController(io, socket) {
  let typingTimeout;

  socket.on(EVENTS.TYPING, ({ isTyping }) => {
    const roomId = socket.data.roomId;
    const user = socket.data.user?.name || "User";
    if (!roomId) return;

    // broadcast typing status
    io.to(roomId).emit(EVENTS.TYPING_STATUS, {
      socketId: socket.id,
      user,
      isTyping: !!isTyping,
    });

    // auto-stop typing after 2s if no updates
    clearTimeout(typingTimeout);
    if (isTyping) {
      typingTimeout = setTimeout(() => {
        io.to(roomId).emit(EVENTS.TYPING_STATUS, {
          socketId: socket.id,
          user,
          isTyping: false,
        });
      }, 2000);
    }
  });

  socket.on("disconnect", () => {
    clearTimeout(typingTimeout);
  });
}