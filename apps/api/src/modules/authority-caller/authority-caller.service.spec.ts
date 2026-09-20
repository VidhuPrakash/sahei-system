import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorityCallerService } from "./authority-caller.service.js";

function makePrismaMock() {
  return {
    authorityNumber: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

describe("AuthorityCallerService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let appointments: { findUpcomingForBusiness: ReturnType<typeof vi.fn> };
  let authority: AuthorityCallerService;

  beforeEach(() => {
    prisma = makePrismaMock();
    appointments = { findUpcomingForBusiness: vi.fn().mockResolvedValue([]) };
    authority = new AuthorityCallerService(prisma as never, appointments as never);
  });

  describe("lookup", () => {
    it("returns isAuthority: false when the business has no authority numbers", async () => {
      const result = await authority.lookup({ businessId: "business-1", phoneNumber: "9847012345" });
      expect(result).toEqual({ isAuthority: false });
    });

    it("matches across differently formatted phone numbers", async () => {
      prisma.authorityNumber.findMany.mockResolvedValue([
        { name: "Ravi", phoneNumber: "+91 98470 12345" },
      ]);
      const result = await authority.lookup({ businessId: "business-1", phoneNumber: "09847012345" });
      expect(result).toEqual({ isAuthority: true, name: "Ravi" });
    });

    it("scopes the lookup query to the given business", async () => {
      await authority.lookup({ businessId: "business-1", phoneNumber: "9847012345" });
      expect(prisma.authorityNumber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: "business-1" } }),
      );
    });
  });

  describe("listAppointments", () => {
    it("defaults to a single IST calendar day when no date/from/to given", async () => {
      await authority.listAppointments({ businessId: "business-1" } as never);
      const [, from, to] = appointments.findUpcomingForBusiness.mock.calls[0]!;
      expect(to.getTime() - from.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
    });

    it("passes status through to findUpcomingForBusiness", async () => {
      await authority.listAppointments({ businessId: "business-1", status: "CONFIRMED" } as never);
      expect(appointments.findUpcomingForBusiness).toHaveBeenCalledWith(
        "business-1",
        expect.any(Date),
        expect.any(Date),
        "CONFIRMED",
      );
    });

    it("maps rows into the compact output shape with IST date/time", async () => {
      appointments.findUpcomingForBusiness.mockResolvedValue([
        {
          scheduledAt: new Date("2026-09-15T04:30:00.000Z"),
          customerName: "Anu",
          service: { name: "Haircut" },
          status: "CONFIRMED",
        },
      ]);
      const result = await authority.listAppointments({ businessId: "business-1" } as never);
      expect(result).toEqual({
        count: 1,
        appointments: [
          { date: "2026-09-15", time: "10:00", customerName: "Anu", service: "Haircut", status: "CONFIRMED" },
        ],
      });
    });

    it("prefers date over from/to when both are given", async () => {
      await authority.listAppointments({
        businessId: "business-1",
        date: "2026-09-15",
        from: "2026-09-01",
        to: "2026-09-30",
      } as never);
      const [, from, to] = appointments.findUpcomingForBusiness.mock.calls[0]!;
      expect(from.toISOString()).toBe(new Date("2026-09-15T00:00:00+05:30").toISOString());
      expect(to.toISOString()).toBe(new Date("2026-09-15T23:59:59.999+05:30").toISOString());
    });
  });
});
