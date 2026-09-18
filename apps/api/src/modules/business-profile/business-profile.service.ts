import { Injectable } from "@nestjs/common";
import type { BusinessProfile, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class BusinessProfileService {
  constructor(private readonly prisma: PrismaService) {}

  findByOrgId(orgId: string): Promise<BusinessProfile | null> {
    return this.prisma.businessProfile.findUnique({
      where: { orgId },
      include: { services: true, businessHours: true, authorityNumbers: true },
    });
  }

  findById(id: string): Promise<BusinessProfile | null> {
    return this.prisma.businessProfile.findUnique({ where: { id } });
  }

  create(data: Prisma.BusinessProfileCreateInput): Promise<BusinessProfile> {
    return this.prisma.businessProfile.create({ data });
  }

  update(id: string, data: Prisma.BusinessProfileUpdateInput): Promise<BusinessProfile> {
    return this.prisma.businessProfile.update({ where: { id }, data });
  }

  remove(id: string): Promise<BusinessProfile> {
    return this.prisma.businessProfile.delete({ where: { id } });
  }

  async replaceAuthorityNumbers(businessId: string, entries: { name: string; phoneNumber: string }[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.authorityNumber.deleteMany({ where: { businessId } }),
      this.prisma.authorityNumber.createMany({
        data: entries.map((entry) => ({ businessId, name: entry.name, phoneNumber: entry.phoneNumber })),
      }),
    ]);
  }
}
