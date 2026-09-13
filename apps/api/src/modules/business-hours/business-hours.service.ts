import { Injectable } from "@nestjs/common";
import type { BusinessHours } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class BusinessHoursService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForBusiness(businessId: string): Promise<BusinessHours[]> {
    return this.prisma.businessHours.findMany({
      where: { businessId },
      orderBy: { dayOfWeek: "asc" },
    });
  }

  upsertForDay(
    businessId: string,
    dayOfWeek: number,
    openTime: number,
    closeTime: number,
  ): Promise<BusinessHours> {
    return this.prisma.businessHours.upsert({
      where: { businessId_dayOfWeek: { businessId, dayOfWeek } },
      update: { openTime, closeTime },
      create: { businessId, dayOfWeek, openTime, closeTime },
    });
  }

  remove(id: string): Promise<BusinessHours> {
    return this.prisma.businessHours.delete({ where: { id } });
  }
}
