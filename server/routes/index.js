import { Router } from "express";
import healthRoutes from "./health.routes.js";
import roomsRoutes from "./rooms.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/rooms", roomsRoutes);

export default router;