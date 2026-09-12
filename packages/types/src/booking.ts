export interface BookingPayload {
  orgId: string;
  callId: string;
  customerName: string;
  customerPhone: string;
  requestedAt: string;
  notes?: string;
}
