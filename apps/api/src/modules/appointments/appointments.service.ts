import { randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Appointment, AppointmentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AppointmentScope } from "./dto/list-appointments-query.dto.js";

function scopeToRange(scope?: AppointmentScope): Prisma.DateTimeFilter | undefined {
  if (!scope) return undefined;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (scope === "today") return { gte: startOfToday, lt: startOfTomorrow };
  if (scope === "upcoming") return { gte: startOfTomorrow };
  return { lt: startOfToday };
}

export interface CreateAppointmentInput {
  businessId: string;
  serviceId: string;
  customerName: string;
  customerPhone: string;
  scheduledAt: Date;
  notes?: string;
}

export type AppointmentWithService = Prisma.AppointmentGetPayload<{
  include: { service: { select: { name: true } } };
}>;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAppointmentInput): Promise<Appointment> {
    return this.prisma.appointment.create({
      data: {
        ...input,
        bookingReference: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
  }

  findByReference(bookingReference: string): Promise<Appointment | null> {
    return this.prisma.appointment.findUnique({ where: { bookingReference } });
  }

  findUpcomingForBusiness(businessId: string, from: Date, to: Date): Promise<Appointment[]> {
    return this.prisma.appointment.findMany({
      where: { businessId, scheduledAt: { gte: from, lte: to } },
      orderBy: { scheduledAt: "asc" },
    });
  }

  updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    return this.prisma.appointment.update({ where: { id }, data: { status } });
  }

  async updateStatusForOrg(
    orgId: string,
    id: string,
    status: AppointmentStatus,
  ): Promise<AppointmentWithService> {
    // Confirm the appointment belongs to this org before mutating it — orgId
    // never appears in the update's `where`, so this lookup is the only guard
    // against one org changing another org's appointment by guessing an id.
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, business: { orgId } },
    });
    if (!appointment) {
      throw new NotFoundException(`No appointment ${id} for this organization`);
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status },
      include: { service: { select: { name: true } } },
    });
  }

  findByOrgId(
    orgId: string,
    filters: {
      status?: AppointmentStatus;
      q?: string;
      scope?: AppointmentScope;
      skip?: number;
      take?: number;
    } = {},
  ): Promise<AppointmentWithService[]> {
    const scheduledAtRange = scopeToRange(filters.scope);

    return this.prisma.appointment.findMany({
      where: {
        business: { orgId },
        ...(filters.status ? { status: filters.status } : {}),
        ...(scheduledAtRange ? { scheduledAt: scheduledAtRange } : {}),
        ...(filters.q
          ? {
              OR: [
                { customerName: { contains: filters.q, mode: "insensitive" } },
                { customerPhone: { contains: filters.q, mode: "insensitive" } },
                { bookingReference: { contains: filters.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { service: { select: { name: true } } },
      // Past reads most-recent-first; today/upcoming read soonest-first.
      orderBy: { scheduledAt: filters.scope === "past" || !filters.scope ? "desc" : "asc" },
      skip: filters.skip ?? 0,
      // Bounded by default so a long-lived org's full history is never fetched in one page.
      take: filters.take ?? 25,
    });
  }
}
