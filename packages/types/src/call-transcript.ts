export const CALL_OUTCOMES = ["BOOKED", "INQUIRY", "NO_OUTCOME"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export interface CallTranscriptTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CallTranscript {
  id: string;
  businessId: string;
  callId: string;
  customerPhone: string;
  outcome: CallOutcome;
  bookingReference: string | null;
  transcript: CallTranscriptTurn[];
  startedAt: string;
  endedAt: string;
  createdAt: string;
}
