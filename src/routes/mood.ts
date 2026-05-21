import express from "express";
import { createMood, getMoods } from "../controllers/moodController";
import { auth } from "../middleware/auth";

const router = express.Router();

router.use(auth);

// GET  /api/mood  — fetch mood history for logged-in user
router.get("/", getMoods);

// POST /api/mood  — save a new mood entry
router.post("/", createMood);

export default router;
