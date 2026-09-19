import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingService } from "./booking.service.js";

function makePrismaMock() {
  return {
    appointment: { findMany: vi.fn().mockResolvedValue([]) },
    inquiry: { create: vi.fn() },
  };
}

function makeService(overrides: Partial<{ durationMinutes: number; name: string }> = {}) {
  return {
    id: "service-1",
    businessId: "business-1",
    name: overrides.name ?? "Haircut",
    description: null,
    durationMinutes: overrides.durationMinutes ?? 30,
    price: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("BookingService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let businessProfiles: { findById: ReturnType<typeof vi.fn> };
  let services: { findAllForBusiness: ReturnType<typeof vi.fn> };
  let businessHours: { findAllForBusiness: ReturnType<typeof vi.fn> };
  let appointments: {
    create: ReturnType<typeof vi.fn>;
    findActiveByPhone: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let booking: BookingService;

  const business = { id: "business-1", orgId: "org-1" } as never;
  // Tuesday 2026-09-15, 09:00-17:00
  const tuesdayHours = [{ id: "h1", businessId: "business-1", dayOfWeek: 2, openTime: 540, closeTime: 1020 }];

  beforeEach(() => {
    prisma = makePrismaMock();
    businessProfiles = { findById: vi.fn().mockResolvedValue(business) };
    services = { findAllForBusiness: vi.fn().mockResolvedValue([makeService()]) };
    businessHours = { findAllForBusiness: vi.fn().mockResolvedValue(tuesdayHours) };
    appointments = { create: vi.fn(), findActiveByPhone: vi.fn().mockResolvedValue([]), cancel: vi.fn() };

    booking = new BookingService(
      prisma as never,
      businessProfiles as never,
      services as never,
      businessHours as never,
      appointments as never,
    );
  });

  describe("checkAvailability", () => {
    it("throws NotFoundException when the business does not exist", async () => {
      businessProfiles.findById.mockResolvedValue(null);
      await expect(
        booking.checkAvailability({ businessId: "nope", service: "Haircut", date: "2026-09-15", time: "10:00" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException with a service_not_found code when no service matches", async () => {
      services.findAllForBusiness.mockResolvedValue([makeService({ name: "Manicure" })]);
      const err = await booking
        .checkAvailability({ businessId: "business-1", service: "Haircut", date: "2026-09-15", time: "10:00" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toMatchObject({ error: "service_not_found" });
    });

    it("throws BadRequestException with an ambiguous_service code when multiple services match", async () => {
      services.findAllForBusiness.mockResolvedValue([
        makeService({ name: "Hair Spa" }),
        makeService({ name: "Hair Color" }),
      ]);
      const err = await booking
        .checkAvailability({ businessId: "business-1", service: "hair", date: "2026-09-15", time: "10:00" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({ error: "ambiguous_service" });
    });

    it("is unavailable when the business is closed that day", async () => {
      businessHours.findAllForBusiness.mockResolvedValue([]);
      const result = await booking.checkAvailability({
        businessId: "business-1",
        service: "Haircut",
        date: "2026-09-15",
        time: "10:00",
      });
      expect(result).toEqual({ available: false, reason: expect.stringContaining("closed") });
    });

    it("is unavailable outside business hours", async () => {
      const result = await booking.checkAvailability({
        businessId: "business-1",
        service: "Haircut",
        date: "2026-09-15",
        time: "18:00",
      });
      expect(result.available).toBe(false);
    });

    it("is unavailable when it overlaps an existing appointment", async () => {
      prisma.appointment.findMany.mockResolvedValue([
        {
          scheduledAt: new Date("2026-09-15T04:15:00.000Z"), // 09:45 IST
          service: { durationMinutes: 30 },
        },
      ]);
      const result = await booking.checkAvailability({
        businessId: "business-1",
        service: "Haircut",
        date: "2026-09-15",
        time: "10:00",
      });
      expect(result).toEqual({ available: false, reason: expect.stringContaining("overlaps") });
    });

    it("is available for an open, non-conflicting slot", async () => {
      const result = await booking.checkAvailability({
        businessId: "business-1",
        service: "Haircut",
        date: "2026-09-15",
        time: "10:00",
      });
      expect(result).toEqual({ available: true });
    });
  });

  describe("bookAppointment", () => {
    const dto = {
      businessId: "business-1",
      service: "Haircut",
      date: "2026-09-15",
      time: "10:00",
      customerName: "Anu",
      customerArea: "Kaloor",
    };

    it("returns failed status without creating an appointment when the slot is unavailable", async () => {
      businessHours.findAllForBusiness.mockResolvedValue([]);
      const result = await booking.bookAppointment(dto, "+919999999999");
      expect(result.status).toBe("failed");
      expect(appointments.create).not.toHaveBeenCalled();
    });

    it("creates the appointment and returns the booking reference when available", async () => {
      appointments.create.mockResolvedValue({ bookingReference: "ABCD1234" });
      const result = await booking.bookAppointment(dto, "+919999999999");
      expect(result).toEqual({ status: "confirmed", bookingReference: "ABCD1234" });
      expect(appointments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: "business-1",
          serviceId: "service-1",
          customerName: "Anu",
          customerPhone: "+919999999999",
          notes: "Area: Kaloor",
        }),
      );
    });

    it("retries booking-reference generation on a unique-constraint collision", async () => {
      const collision = new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6.16.0",
      });
      appointments.create.mockRejectedValueOnce(collision).mockResolvedValueOnce({
        bookingReference: "EFGH5678",
      });
      const result = await booking.bookAppointment(dto, "+919999999999");
      expect(result).toEqual({ status: "confirmed", bookingReference: "EFGH5678" });
      expect(appointments.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("cancelBooking", () => {
    it("throws NotFoundException when the business does not exist", async () => {
      businessProfiles.findById.mockResolvedValue(null);
      await expect(
        booking.cancelBooking({ businessId: "nope", customerPhone: "+919999999999" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException with an appointment_not_found code when nothing matches", async () => {
      appointments.findActiveByPhone.mockResolvedValue([]);
      const err = await booking
        .cancelBooking({ businessId: "business-1", customerPhone: "+919999999999" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toMatchObject({ error: "appointment_not_found" });
    });

    it("throws BadRequestException with an ambiguous_appointment code and candidates when multiple match", async () => {
      appointments.findActiveByPhone.mockResolvedValue([
        { id: "a1", scheduledAt: new Date("2026-09-20T04:30:00.000Z"), bookingReference: "AAAA1111" },
        { id: "a2", scheduledAt: new Date("2026-09-22T04:30:00.000Z"), bookingReference: "BBBB2222" },
      ]);
      const err = await booking
        .cancelBooking({ businessId: "business-1", customerPhone: "+919999999999" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        error: "ambiguous_appointment",
        candidates: [
          { scheduledAt: new Date("2026-09-20T04:30:00.000Z"), bookingReference: "AAAA1111" },
          { scheduledAt: new Date("2026-09-22T04:30:00.000Z"), bookingReference: "BBBB2222" },
        ],
      });
      expect(appointments.cancel).not.toHaveBeenCalled();
    });

    it("cancels the single matching appointment", async () => {
      appointments.findActiveByPhone.mockResolvedValue([{ id: "a1", bookingReference: "AAAA1111" }]);
      appointments.cancel.mockResolvedValue({ id: "a1", bookingReference: "AAAA1111" });
      const result = await booking.cancelBooking({ businessId: "business-1", customerPhone: "+919999999999" });
      expect(result).toEqual({ status: "cancelled", bookingReference: "AAAA1111" });
      expect(appointments.cancel).toHaveBeenCalledWith("business-1", "+919999999999", "a1");
    });
  });

  describe("logInquiry", () => {
    it("throws NotFoundException when the business does not exist", async () => {
      businessProfiles.findById.mockResolvedValue(null);
      await expect(
        booking.logInquiry({ businessId: "nope", category: "off_topic" as never, summary: "asked about parking" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("persists the inquiry with an uppercased category", async () => {
      prisma.inquiry.create.mockResolvedValue({ id: "inq-1" });
      const result = await booking.logInquiry({
        businessId: "business-1",
        category: "off_topic" as never,
        summary: "asked about parking",
      });
      expect(result).toEqual({ logged: true, inquiryId: "inq-1" });
      expect(prisma.inquiry.create).toHaveBeenCalledWith({
        data: { businessId: "business-1", category: "OFF_TOPIC", summary: "asked about parking" },
      });
    });
  });
});
