import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Appointment, AppointmentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";

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

  findByOrgId(
    orgId: string,
    filters: { status?: AppointmentStatus; q?: string; skip?: number; take?: number } = {},
  ): Promise<AppointmentWithService[]> {
    return this.prisma.appointment.findMany({
      where: {
        business: { orgId },
        ...(filters.status ? { status: filters.status } : {}),
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
      orderBy: { scheduledAt: "desc" },
      skip: filters.skip ?? 0,
      // Bounded by default so a long-lived org's full history is never fetched in one page.
      take: filters.take ?? 25,
    });
  }
}
