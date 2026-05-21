import { Router } from "express";
import { logActivity, getActivities } from "../controllers/activityController";
import { auth } from "../middleware/auth";

const router = Router();

router.post("/", auth, logActivity);
router.get("/", auth, getActivities);

export default router;