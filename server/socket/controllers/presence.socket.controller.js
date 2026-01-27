import { EVENTS } from "../events.js";
import { setSpeaking, getSpeaking } from "../../services/presence.service.js";

export function presenceSocketController(io, socket) {
  socket.on(EVENTS.PRESENCE_SPEAKING, async ({ isSpeaking }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    await setSpeaking(roomId, socket.id, !!isSpeaking);
    const speaking = await getSpeaking(roomId);

    io.to(roomId).emit(EVENTS.PRESENCE_SPEAKING_LIST, speaking);
  });
}