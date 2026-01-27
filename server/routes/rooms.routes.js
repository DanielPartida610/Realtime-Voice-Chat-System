import { Router } from "express";
import { listRooms } from "../controllers/rooms.controller.js";

const router = Router();
router.get("/", listRooms);

export default router;