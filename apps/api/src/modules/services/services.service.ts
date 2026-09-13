import { Injectable } from "@nestjs/common";
import type { Prisma, Service } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForBusiness(businessId: string): Promise<Service[]> {
    return this.prisma.service.findMany({ where: { businessId } });
  }

  findById(id: string): Promise<Service | null> {
    return this.prisma.service.findUnique({ where: { id } });
  }

  create(data: Prisma.ServiceCreateInput): Promise<Service> {
    return this.prisma.service.create({ data });
  }

  update(id: string, data: Prisma.ServiceUpdateInput): Promise<Service> {
    return this.prisma.service.update({ where: { id }, data });
  }

  remove(id: string): Promise<Service> {
    return this.prisma.service.delete({ where: { id } });
  }
}
