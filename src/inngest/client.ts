import { Inngest } from "inngest";

// Initialize the Inngest client
export const inngest = new Inngest({
  id: "ai-therapy-agent",
  // Set INNGEST_EVENT_KEY (and INNGEST_SIGNING_KEY) in your environment
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Export the functions array (this will be populated by the functions.ts file)
export const functions: any[] = [];
