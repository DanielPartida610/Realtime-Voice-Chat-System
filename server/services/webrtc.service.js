// mostly here for validation / keeping controllers clean
export function validateSignalPayload({ to }) {
  if (!to) throw new Error("Missing `to` in WebRTC payload");
}