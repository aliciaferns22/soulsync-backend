import express from "express";
import {
  createChatSession,
  getChatSession,
  sendMessage,
  getChatHistory,
  getAllSessions,
  deleteSession,
  analyseCrisis,
  analyseSession,  // ← NEW end-of-session mood analysis
} from "../controllers/chat";
import { auth } from "../middleware/auth";

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

// Get all chat sessions for the logged-in user
router.get("/sessions", getAllSessions);

// Create a new chat session
router.post("/sessions", createChatSession);

// Delete a chat session
router.delete("/sessions/:sessionId", deleteSession);

// Get a specific chat session
router.get("/sessions/:sessionId", getChatSession);

// Send a message in a chat session
router.post("/sessions/:sessionId/messages", sendMessage);

// Get chat history for a session
router.get("/sessions/:sessionId/history", getChatHistory);

// End-of-session mood analysis — call this once when the session ends
router.post("/sessions/:sessionId/analyse", analyseSession);

// Crisis analysis
router.post("/crisis-analysis", analyseCrisis);

export default router;