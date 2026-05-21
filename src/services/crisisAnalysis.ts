// ─────────────────────────────────────────────────────────────────────────────
// src/services/crisisAnalysis.ts
//
// Uses Groq (same as the rest of your backend) to score conversation severity.
// Returns a 0–10 severity score and a recommended action.
// ─────────────────────────────────────────────────────────────────────────────

import Groq from "groq-sdk";
import { logger } from "../utils/logger";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface CrisisAnalysisResult {
  severity: number;
  reason: string;
  recommendedAction: "none" | "monitor" | "intervene" | "emergency";
}

const SYSTEM_PROMPT = `You are a mental health crisis assessment tool. Analyse the conversation and return ONLY a valid JSON object — no markdown, no extra text.

SEVERITY SCALE:
0-2  = No distress. Normal emotions.
3-4  = Mild distress. Sadness, worry, everyday struggles.
5-6  = Moderate. Persistent hopelessness or worthlessness, no explicit crisis.
7-8  = High. Explicit self-harm ideation or suicidal thoughts.
9-10 = Critical. Stated intent, specific plan, or immediate danger.

RULES:
- Context matters. "I want to kill this bug" = 0. "I want to kill myself" = 9.
- Look at the trend across ALL messages, not just the latest.
- When unsure, score conservatively (lower).
- Never assume positive intent for explicit self-harm language.

Return ONLY this JSON structure:
{
  "severity": <number 0-10>,
  "reason": "<one sentence explaining the score>",
  "recommendedAction": "<none|monitor|intervene|emergency>"
}`;

export async function analyseCrisisSeverity(
  messages: { role: string; content: string }[]
): Promise<CrisisAnalysisResult> {
  try {
    const conversationText = messages
      .slice(-10)
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n");

    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyse this conversation:\n\n${conversationText}`,
        },
      ],
      max_tokens: 200,
    });

    const text = result.choices[0].message.content?.trim() || "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as CrisisAnalysisResult;

    if (typeof parsed.severity !== "number") parsed.severity = 0;
    parsed.severity = Math.max(0, Math.min(10, Math.round(parsed.severity)));

    logger.info("Crisis analysis complete:", {
      severity: parsed.severity,
      action: parsed.recommendedAction,
    });

    return parsed;
  } catch (error) {
    logger.error("Crisis analysis failed:", error);
    return {
      severity: 0,
      reason: "Analysis unavailable",
      recommendedAction: "none",
    };
  }
}
