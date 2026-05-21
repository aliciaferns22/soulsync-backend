import { Request, Response } from "express";
import { ChatSession, IChatSession } from "../models/ChatSession";
import Groq from "groq-sdk";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import { inngest } from "../inngest/client";
import { User } from "../models/User";
import { InngestSessionResponse, InngestEvent } from "../types/inngest";
import { Types } from "mongoose";
import { analyseCrisisSeverity } from "../services/crisisAnalysis";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ─── WHO / AFSP Safe Messaging System Prompt ────────────────────────────────
const SYSTEM_PROMPT = `You are a compassionate AI therapy assistant trained to follow
WHO and AFSP safe messaging guidelines. Your role is to:
1. Provide empathetic and supportive responses
2. Use evidence-based therapeutic techniques (CBT, DBT, mindfulness)
3. Maintain professional boundaries at all times
4. Monitor for risk factors and respond with care

SAFE MESSAGING RULES — non-negotiable, always follow these:
- NEVER use the phrase "committed suicide" — always say "died by suicide"
- NEVER describe, suggest, or reference any method of self-harm or suicide
- NEVER sensationalise or romanticise self-harm or suicidal thoughts
- If a user expresses suicidal ideation, self-harm urges, or severe distress, ALWAYS:
    1. Acknowledge their pain warmly ("That sounds incredibly painful")
    2. Ask gently if they are safe right now ("Are you safe right now?")
    3. Let them know support is available ("There are people who want to help")
    4. Mention iCall (India): 9152987821, or Vandrevala Foundation: 1860-2662-345
- NEVER minimise feelings (e.g. "Others have it worse", "You'll be fine")
- NEVER promise outcomes you cannot guarantee
- NEVER give medical diagnoses or medication advice

CHECK-IN RULE — after any conversation involving distress, grief, loss, trauma,
or expressions of hopelessness, always end your response with a gentle check-in
question, e.g. "How are you feeling right now after sharing that?" or
"Is there anything else on your mind you'd like to talk about?"

RESPONSE STYLE:
- Maximum 3–4 short sentences per response
- Ask one follow-up question to keep the conversation going
- Be warm but concise, like a real therapy conversation`;
// ────────────────────────────────────────────────────────────────────────────

export const createChatSession = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = new Types.ObjectId(req.user.id);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const sessionId = uuidv4();
    const session = new ChatSession({
      sessionId,
      userId,
      startTime: new Date(),
      status: "active",
      messages: [],
    });

    await session.save();
    res.status(201).json({ message: "Chat session created successfully", sessionId: session.sessionId });
  } catch (error) {
    logger.error("Error creating chat session:", error);
    res.status(500).json({ message: "Error creating chat session", error: error instanceof Error ? error.message : "Unknown error" });
  }
};

export const getAllSessions = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }
    const userId = new Types.ObjectId(req.user.id);
    const sessions = await ChatSession.find({ userId }).sort({ updatedAt: -1 });
    res.json(sessions);
  } catch (error) {
    logger.error("Error fetching all sessions:", error);
    res.status(500).json({ message: "Error fetching sessions" });
  }
};

export const deleteSession = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }
    const { sessionId } = req.params;
    const userId = new Types.ObjectId(req.user.id);
    const session = await ChatSession.findOne({ sessionId });

    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await ChatSession.deleteOne({ sessionId });
    logger.info(`Session deleted: ${sessionId}`);
    res.json({ message: "Session deleted successfully" });
  } catch (error) {
    logger.error("Error deleting session:", error);
    res.status(500).json({ message: "Error deleting session" });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;
    const userId = new Types.ObjectId(req.user.id);

    logger.info("Processing message:", { sessionId, message });

    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (session.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Build conversation history for context
    const conversationHistory = session.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Response call — uses full SYSTEM_PROMPT with safe messaging
    const aiResult = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversationHistory,
        { role: "user", content: message },
      ],
      max_tokens: 600,
    });

    const response =
      aiResult.choices[0].message.content?.trim() ||
      "I'm here to support you. Could you tell me more about what's on your mind?";

    logger.info("Generated response:", response);

    // Persist both messages — no per-message analysis, keep it clean
    const now = new Date();
    session.messages.push({ role: "user", content: message, timestamp: now });
    session.messages.push({
      role: "assistant",
      content: response,
      timestamp: new Date(),
    });

    (session as any).updatedAt = new Date();
    await session.save();

    logger.info("Session updated:", { sessionId });

    res.json({
      response,
      message: response,
    });
  } catch (error) {
    logger.error("Error in sendMessage:", error);
    res.status(500).json({
      message: "Error processing message",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ─── NEW: End-of-session mood analysis ───────────────────────────────────────
// Called by the frontend when the user clicks "End Session" or closes the panel.
// Runs a single comprehensive analysis over the full conversation and returns
// the mood data. Also saves moodScore to the session document.
export const analyseSession = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { sessionId } = req.params;
    const userId = new Types.ObjectId(req.user.id);
    const session = await ChatSession.findOne({ sessionId });

    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (session.messages.length === 0) {
      return res.status(400).json({ message: "No messages to analyse" });
    }

    // Build a condensed transcript for analysis
    const transcript = session.messages
      .map((m) => `${m.role === "user" ? "Patient" : "Therapist"}: ${m.content}`)
      .join("\n");

    const analysisPrompt = `You are a clinical mood assessment AI. Analyse the following therapy session transcript and return ONLY a valid JSON object with no markdown or extra text.

Transcript:
${transcript}

Required JSON (all fields required):
{
  "emotionalState": "string — primary emotion detected overall (e.g. anxious, sad, hopeful, neutral)",
  "themes": ["array of strings — up to 5 key psychological themes discussed"],
  "riskLevel": <number 0-10 — 0 is no risk, 10 is crisis>,
  "recommendedApproach": "string — brief clinical recommendation for follow-up",
  "progressIndicators": ["array of strings — positive signs observed, if any"],
  "moodScore": <number 0-100 — overall session mood score where 100 is very positive>
}`;

    const analysisResult = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: analysisPrompt }],
      max_tokens: 700,
    });

    const analysisText = analysisResult.choices[0].message.content?.trim() || "{}";
    const cleanAnalysis = analysisText.replace(/```json\n|\n```|```/g, "").trim();

    let analysis: any = {
      emotionalState: "neutral",
      themes: [],
      riskLevel: 0,
      recommendedApproach: "Continue supportive therapy",
      progressIndicators: [],
      moodScore: 50,
    };

    try {
      analysis = JSON.parse(cleanAnalysis);
    } catch (e) {
      logger.warn("analyseSession: JSON parse failed, using defaults", cleanAnalysis);
    }

    // Clamp and validate moodScore
    const moodScore = Math.min(100, Math.max(0, Number(analysis.moodScore) || 50));
    analysis.moodScore = moodScore;

    // Mark session as completed and store the mood score
    session.status = "completed";
    (session as any).moodScore = moodScore;
    (session as any).updatedAt = new Date();
    await session.save();

    logger.info("Session analysed:", { sessionId, moodScore, emotionalState: analysis.emotionalState });

    res.json({ analysis });
  } catch (error) {
    logger.error("Error in analyseSession:", error);
    res.status(500).json({ message: "Error analysing session", error: error instanceof Error ? error.message : "Unknown error" });
  }
};

export const analyseCrisis = async (req: Request, res: Response) => {
  try {
    const { messages } = req.body as {
      messages: { role: string; content: string }[];
    };
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }
    const result = await analyseCrisisSeverity(messages);
    logger.info("Crisis analysis result:", { userId: req.user?.id, severity: result.severity, action: result.recommendedAction });
    res.json(result);
  } catch (error) {
    logger.error("Error in analyseCrisis:", error);
    res.status(500).json({ severity: 0, reason: "Analysis error", recommendedAction: "none" });
  }
};

export const getSessionHistory = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = new Types.ObjectId(req.user.id);

    // FIX: use findOne({ sessionId }) instead of findById(sessionId)
    // Sessions are identified by their UUID sessionId field, not MongoDB _id
    const session = await ChatSession.findOne({ sessionId });

    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    res.json(session.messages);
  } catch (error) {
    logger.error("Error fetching session history:", error);
    res.status(500).json({ message: "Error fetching session history" });
  }
};

export const getChatSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const chatSession = await ChatSession.findOne({ sessionId });
    if (!chatSession) return res.status(404).json({ error: "Chat session not found" });
    res.json(chatSession);
  } catch (error) {
    logger.error("Failed to get chat session:", error);
    res.status(500).json({ error: "Failed to get chat session" });
  }
};

export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = new Types.ObjectId(req.user.id);

    // FIX: use findOne({ sessionId }) instead of findById(sessionId)
    const session = await ChatSession.findOne({ sessionId });

    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    res.json(session.messages);
  } catch (error) {
    logger.error("Error fetching chat history:", error);
    res.status(500).json({ message: "Error fetching chat history" });
  }
};