import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Appointment, AppointmentStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";

export interface CreateAppointmentInput {
  businessId: string;
  serviceId: string;
  customerName: string;
  customerPhone: string;
  scheduledAt: Date;
  notes?: string;
}

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
}
