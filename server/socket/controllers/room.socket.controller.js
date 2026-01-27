import { joinRoom, leaveRoom } from "../../services/room.service.js";
import { addChat, getChatHistory } from "../../services/chat.service.js";
import { setOnline, setOffline } from "../../stores/presence.store.js";

export function roomSocketController(io, socket) {
  socket.on("room:join", async ({ roomId, user }) => {
    const name = user?.name?.trim();
    if (!roomId || !name) return;

    socket.data.roomId = roomId;
    socket.data.user = { name };

    // ✅ store presence mapping
    await setOnline(name, socket.id);

    socket.join(roomId);

    // ✅ update room user list
    const users = await joinRoom(roomId, socket.id, { name });
    io.to(roomId).emit("room:users", users);

    // ✅ send history to the joining socket (THIS FIXES "late joiners can't see")
    const history = await getChatHistory(roomId);
    socket.emit("chat:history", history);

    // ✅ system joined message
    const msg = {
      id: `${Date.now()}-${Math.random()}`,
      roomId,
      type: "system",
      text: `${name} joined the room`,
      user: "system",
      createdAt: Date.now(),
    };
    await addChat(roomId, msg);
    io.to(roomId).emit("chat:message", msg);
  });

  // ✅ use disconnecting so roomId + data still exists
  socket.on("disconnecting", async () => {
    const roomId = socket.data.roomId;
    const name = socket.data.user?.name;
    if (!roomId || !name) return;

    // ✅ cleanup presence mapping only if it still points to this socket
    await setOffline(name, socket.id);

    const users = await leaveRoom(roomId, socket.id);
    io.to(roomId).emit("room:users", users);

    const msg = {
      id: `${Date.now()}-${Math.random()}`,
      roomId,
      type: "system",
      text: `${name} left the room`,
      user: "system",
      createdAt: Date.now(),
    };
    await addChat(roomId, msg);
    io.to(roomId).emit("chat:message", msg);
  });
}