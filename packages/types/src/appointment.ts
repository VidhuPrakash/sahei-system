export const APPOINTMENT_STATUSES = ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface Appointment {
  id: string;
  businessId: string;
  serviceId: string;
  customerName: string;
  customerPhone: string;
  scheduledAt: string;
  status: AppointmentStatus;
  bookingReference: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  service: { name: string };
}
