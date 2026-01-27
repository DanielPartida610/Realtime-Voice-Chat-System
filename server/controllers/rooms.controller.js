import { getActiveRooms } from "../services/room.service.js";

export async function listRooms(req, res, next) {
  try {
    const rooms = await getActiveRooms();
    res.json({ rooms });
  } catch (e) {
    next(e);
  }
}