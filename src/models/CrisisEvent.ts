// ─────────────────────────────────────────────────────────────────────────────
// src/models/CrisisEvent.ts  — NEW FILE
// Logs every detected crisis for review and audit purposes.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose, { Document, Schema } from "mongoose";

export interface ICrisisEvent extends Document {
  sessionId: string;
  userId: string;
  severity: number;
  reason: string;
  recommendedAction: "none" | "monitor" | "intervene" | "emergency";
  messageSnap: string[];       // Last 3 user messages (for human review if needed)
  resourcesShown: boolean;     // Did the modal appear?
  userConfirmedSafe: boolean;  // Did user confirm they're okay?
  createdAt: Date;
}

const crisisEventSchema = new Schema<ICrisisEvent>(
  {
    sessionId:         { type: String, required: true, index: true },
    userId:            { type: String, required: true, index: true },
    severity:          { type: Number, required: true, min: 0, max: 10 },
    reason:            { type: String, default: "" },
    recommendedAction: {
      type: String,
      enum: ["none", "monitor", "intervene", "emergency"],
      default: "monitor",
    },
    messageSnap:       { type: [String], default: [] },
    resourcesShown:    { type: Boolean, default: false },
    userConfirmedSafe: { type: Boolean, default: false },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
  }
);

export const CrisisEvent = mongoose.model<ICrisisEvent>(
  "CrisisEvent",
  crisisEventSchema
);
