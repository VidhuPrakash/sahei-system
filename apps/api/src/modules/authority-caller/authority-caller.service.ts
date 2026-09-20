import { Injectable } from "@nestjs/common";
import { AppointmentsService } from "../appointments/appointments.service.js";
import { BUSINESS_UTC_OFFSET } from "../booking/booking.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AuthorityAppointmentsDto } from "./dto/authority-appointments.dto.js";
import type { AuthorityLookupDto } from "./dto/authority-lookup.dto.js";
import { normalizePhone } from "./phone.util.js";

function istDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function istTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

@Injectable()
export class AuthorityCallerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointments: AppointmentsService,
  ) {}

  async lookup(dto: AuthorityLookupDto): Promise<{ isAuthority: boolean; name?: string }> {
    const target = normalizePhone(dto.phoneNumber);
    // ponytail: in-memory match because stored numbers aren't normalized on
    // write; normalize-on-write becomes worth it if a business's authority
    // list ever grows past a handful of rows.
    const numbers = await this.prisma.authorityNumber.findMany({
      where: { businessId: dto.businessId },
      select: { name: true, phoneNumber: true },
    });
    const match = numbers.find((n) => normalizePhone(n.phoneNumber) === target);
    return match ? { isAuthority: true, name: match.name } : { isAuthority: false };
  }

  async listAppointments(dto: AuthorityAppointmentsDto) {
    const { from, to } = this.resolveRange(dto);
    const rows = await this.appointments.findUpcomingForBusiness(dto.businessId, from, to, dto.status);
    return {
      count: rows.length,
      appointments: rows.map((a) => ({
        date: istDate(a.scheduledAt),
        time: istTime(a.scheduledAt),
        customerName: a.customerName,
        service: a.service.name,
        status: a.status,
      })),
    };
  }

  private resolveRange(dto: AuthorityAppointmentsDto): { from: Date; to: Date } {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const start = dto.date ?? dto.from ?? today;
    const end = dto.date ?? dto.to ?? start;
    return {
      from: new Date(`${start}T00:00:00${BUSINESS_UTC_OFFSET}`),
      to: new Date(`${end}T23:59:59.999${BUSINESS_UTC_OFFSET}`),
    };
  }
}
