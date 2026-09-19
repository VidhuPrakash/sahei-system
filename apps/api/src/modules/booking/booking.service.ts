import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { BusinessProfile, InquiryCategory, Service } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AppointmentsService } from "../appointments/appointments.service.js";
import { BusinessHoursService } from "../business-hours/business-hours.service.js";
import { BusinessProfileService } from "../business-profile/business-profile.service.js";
import { ServicesService } from "../services/services.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { BookAppointmentDto } from "./dto/book-appointment.dto.js";
import type { CancelBookingDto } from "./dto/cancel-booking.dto.js";
import type { CheckAvailabilityDto } from "./dto/check-availability.dto.js";
import type { LogInquiryDto } from "./dto/log-inquiry.dto.js";

/**
 * Pilot scope: BusinessProfile has no timezone column, and every business is
 * assumed to run on India Standard Time. `date`/`time` from the LLM are
 * IST wall-clock values, combined here with a fixed +05:30 offset.
 */
const BUSINESS_UTC_OFFSET = "+05:30";
const BOOKING_REFERENCE_ATTEMPTS = 5;

function normalizeServiceText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

interface Slot {
  scheduledAt: Date;
  dayOfWeek: number;
  minutesFromMidnight: number;
}

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
}

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessProfiles: BusinessProfileService,
    private readonly services: ServicesService,
    private readonly businessHours: BusinessHoursService,
    private readonly appointments: AppointmentsService,
  ) {}

  async checkAvailability(dto: CheckAvailabilityDto): Promise<AvailabilityResult> {
    const { service } = await this.resolveBusinessAndService(dto.businessId, dto.service);
    const slot = this.computeSlot(dto.date, dto.time);
    return this.checkSlotAvailable(dto.businessId, service, slot);
  }

  async bookAppointment(
    dto: BookAppointmentDto,
    customerPhone: string,
  ): Promise<{ status: "confirmed" | "failed"; bookingReference?: string; reason?: string }> {
    const { service } = await this.resolveBusinessAndService(dto.businessId, dto.service);
    const slot = this.computeSlot(dto.date, dto.time);
    const availability = await this.checkSlotAvailable(dto.businessId, service, slot);
    if (!availability.available) {
      return { status: "failed", reason: availability.reason };
    }

    const appointment = await this.createAppointmentWithRetry({
      businessId: dto.businessId,
      serviceId: service.id,
      customerName: dto.customerName,
      customerPhone,
      scheduledAt: slot.scheduledAt,
      notes: `Area: ${dto.customerArea}`,
    });

    return { status: "confirmed", bookingReference: appointment.bookingReference };
  }

  async cancelBooking(dto: CancelBookingDto): Promise<{ status: "cancelled"; bookingReference: string }> {
    const business = await this.businessProfiles.findById(dto.businessId);
    if (!business) {
      throw new NotFoundException(`No business with id ${dto.businessId}`);
    }

    const range = dto.dateHint ? this.dayRangeFrom(dto.dateHint) : { from: new Date() };
    const candidates = await this.appointments.findActiveByPhone(dto.businessId, dto.customerPhone, range);

    if (candidates.length === 0) {
      throw new NotFoundException({
        error: "appointment_not_found",
        message: `No upcoming appointment found for ${dto.customerPhone}`,
      });
    }
    if (candidates.length > 1) {
      throw new BadRequestException({
        error: "ambiguous_appointment",
        message: "Multiple upcoming appointments match — ask the caller which date, then retry with dateHint",
        candidates: candidates.map((a) => ({ scheduledAt: a.scheduledAt, bookingReference: a.bookingReference })),
      });
    }

    // Length is exactly 1 here (checked above), so this index always exists.
    const cancelled = await this.appointments.cancel(dto.businessId, dto.customerPhone, candidates[0]!.id);
    return { status: "cancelled", bookingReference: cancelled.bookingReference };
  }

  async logInquiry(dto: LogInquiryDto): Promise<{ logged: true; inquiryId: string }> {
    const business = await this.businessProfiles.findById(dto.businessId);
    if (!business) {
      throw new NotFoundException(`No business with id ${dto.businessId}`);
    }

    const inquiry = await this.prisma.inquiry.create({
      data: {
        businessId: dto.businessId,
        category: dto.category.toUpperCase() as InquiryCategory,
        summary: dto.summary,
      },
    });

    return { logged: true, inquiryId: inquiry.id };
  }

  private async resolveBusinessAndService(
    businessId: string,
    serviceName: string,
  ): Promise<{ business: BusinessProfile; service: Service }> {
    const business = await this.businessProfiles.findById(businessId);
    if (!business) {
      throw new NotFoundException(`No business with id ${businessId}`);
    }

    // Spoken Malayalam splits compound words inconsistently ("ഹെയർകട്ട്" vs
    // "ഹെയർ കട്ടിങ്") — normalize away whitespace so those still match.
    const needle = normalizeServiceText(serviceName);
    const candidates = (await this.services.findAllForBusiness(businessId)).filter(
      (candidate) =>
        normalizeServiceText(candidate.name).includes(needle) ||
        (candidate.nameLocal && normalizeServiceText(candidate.nameLocal).includes(needle)),
    );

    if (candidates.length === 0) {
      throw new NotFoundException({
        error: "service_not_found",
        message: `No service matching "${serviceName}" for this business`,
      });
    }
    if (candidates.length > 1) {
      throw new BadRequestException({
        error: "ambiguous_service",
        message: `"${serviceName}" matches multiple services — ask the caller to be more specific`,
      });
    }

    // Length is exactly 1 here (checked above), so this index always exists.
    return { business, service: candidates[0]! };
  }

  private dayRangeFrom(dateHint: string): { from: Date; to: Date } {
    const dayStart = new Date(`${dateHint}T00:00:00${BUSINESS_UTC_OFFSET}`);
    const dayEnd = new Date(`${dateHint}T23:59:59${BUSINESS_UTC_OFFSET}`);
    const now = new Date();
    // Clamp so a dateHint of today doesn't resurrect an appointment already passed today.
    return { from: dayStart > now ? dayStart : now, to: dayEnd };
  }

  private computeSlot(date: string, time: string): Slot {
    const scheduledAt = new Date(`${date}T${time}:00${BUSINESS_UTC_OFFSET}`);
    // Weekday is a property of the calendar date alone, independent of timezone.
    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    const [hoursStr, minutesStr] = time.split(":");
    const minutesFromMidnight = Number(hoursStr) * 60 + Number(minutesStr);
    return { scheduledAt, dayOfWeek, minutesFromMidnight };
  }

  private async checkSlotAvailable(
    businessId: string,
    service: Service,
    slot: Slot,
  ): Promise<AvailabilityResult> {
    const hours = await this.businessHours.findAllForBusiness(businessId);
    const dayHours = hours.find((h) => h.dayOfWeek === slot.dayOfWeek);
    if (!dayHours) {
      return { available: false, reason: "Business is closed that day" };
    }
    const slotEnd = slot.minutesFromMidnight + service.durationMinutes;
    if (slot.minutesFromMidnight < dayHours.openTime || slotEnd > dayHours.closeTime) {
      return { available: false, reason: "Requested time is outside business hours" };
    }

    const dayStart = new Date(slot.scheduledAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const sameDayAppointments = await this.prisma.appointment.findMany({
      where: {
        businessId,
        status: { not: "CANCELLED" },
        scheduledAt: { gte: dayStart, lt: dayEnd },
      },
      include: { service: true },
    });

    const requestedStart = slot.scheduledAt.getTime();
    const requestedEnd = requestedStart + service.durationMinutes * 60_000;
    const conflict = sameDayAppointments.some((existing) => {
      const existingStart = existing.scheduledAt.getTime();
      const existingEnd = existingStart + existing.service.durationMinutes * 60_000;
      return requestedStart < existingEnd && existingStart < requestedEnd;
    });

    if (conflict) {
      return { available: false, reason: "Slot overlaps an existing appointment" };
    }

    return { available: true };
  }

  private async createAppointmentWithRetry(
    input: Parameters<AppointmentsService["create"]>[0],
  ): ReturnType<AppointmentsService["create"]> {
    for (let attempt = 1; attempt <= BOOKING_REFERENCE_ATTEMPTS; attempt++) {
      try {
        return await this.appointments.create(input);
      } catch (error) {
        const isUniqueViolation =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!isUniqueViolation || attempt === BOOKING_REFERENCE_ATTEMPTS) {
          throw error;
        }
      }
    }
    throw new Error("Unreachable");
  }
}
