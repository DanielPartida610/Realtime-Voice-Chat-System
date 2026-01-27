import { EVENTS } from "../events.js";
import { validateSignalPayload } from "../../services/webrtc.service.js";

export function webrtcSocketController(io, socket) {
  socket.on(EVENTS.WEBRTC_OFFER, ({ to, offer }) => {
    validateSignalPayload({ to });
    io.to(to).emit(EVENTS.WEBRTC_OFFER, { from: socket.id, offer });
  });

  socket.on(EVENTS.WEBRTC_ANSWER, ({ to, answer }) => {
    validateSignalPayload({ to });
    io.to(to).emit(EVENTS.WEBRTC_ANSWER, { from: socket.id, answer });
  });

  socket.on(EVENTS.WEBRTC_ICE, ({ to, candidate }) => {
    validateSignalPayload({ to });
    io.to(to).emit(EVENTS.WEBRTC_ICE, { from: socket.id, candidate });
  });
}