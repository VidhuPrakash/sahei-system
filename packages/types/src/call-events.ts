export type CallStatus = "ringing" | "in-progress" | "completed" | "failed";

export interface CallEvent {
  callId: string;
  orgId: string;
  status: CallStatus;
  callerNumber: string;
  startedAt: string;
  endedAt?: string;
  transcript?: string;
}
