import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PhoneNumberProvisioningStatus, PhoneNumberRoutingStatus, PhoneNumberSource, PhoneNumberType } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneNumbersService } from './phone-numbers.service.js';

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'phone-1',
    orgId: 'org-1',
    phoneNumber: null,
    source: PhoneNumberSource.NEW,
    forwardingFromNumber: null,
    numberType: null,
    monthlyPriceInr: null,
    provisioningStatus: PhoneNumberProvisioningStatus.PENDING,
    exotelPhoneSid: null,
    routingStatus: PhoneNumberRoutingStatus.PENDING,
    exotelFlowSid: null,
    verificationRequestedAt: null,
    forwardingVerifiedAt: null,
    lastError: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  };
}

function makePricingRow(numberType: PhoneNumberType, monthlyPriceInr: number) {
  return { numberType, monthlyPriceInr, updatedAt: new Date('2026-09-01T00:00:00Z') };
}

function makePrismaMock() {
  return {
    orgPhoneNumber: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    phoneNumberPricing: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(makePricingRow(PhoneNumberType.MOBILE, 999)),
    },
    callTranscript: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

describe('PhoneNumbersService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let exotel: {
    purchaseNumber: ReturnType<typeof vi.fn>;
    attachVoicebotApplet: ReturnType<typeof vi.fn>;
    listAvailableNumbers: ReturnType<typeof vi.fn>;
  };
  let businessProfiles: { findByOrgId: ReturnType<typeof vi.fn> };
  let phoneNumbers: PhoneNumbersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    exotel = { purchaseNumber: vi.fn(), attachVoicebotApplet: vi.fn(), listAvailableNumbers: vi.fn() };
    businessProfiles = { findByOrgId: vi.fn().mockResolvedValue({ id: 'business-1', orgId: 'org-1' }) };
    phoneNumbers = new PhoneNumbersService(prisma as never, exotel as never, businessProfiles as never);
    vi.stubEnv('VOICE_SERVICE_WS_URL', 'wss://voice.sahei.app/ws');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('provision', () => {
    const dto = { source: PhoneNumberSource.NEW, numberType: PhoneNumberType.MOBILE } as never;

    it('throws ConflictException when the org already has a purchased number', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({ provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED, phoneNumber: '+911111111111' }),
      );
      await expect(phoneNumbers.provision('org-1', dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when a request is already awaiting approval', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({ provisioningStatus: PhoneNumberProvisioningStatus.AWAITING_APPROVAL }),
      );
      await expect(phoneNumbers.provision('org-1', dto)).rejects.toThrow(ConflictException);
    });

    it('creates an AWAITING_APPROVAL row priced from the pricing table, not the client', async () => {
      prisma.phoneNumberPricing.findUniqueOrThrow.mockResolvedValue(makePricingRow(PhoneNumberType.MOBILE, 999));
      prisma.orgPhoneNumber.create.mockResolvedValue(
        makeRow({
          numberType: PhoneNumberType.MOBILE,
          monthlyPriceInr: 999,
          provisioningStatus: PhoneNumberProvisioningStatus.AWAITING_APPROVAL,
        }),
      );

      const result = await phoneNumbers.provision('org-1', dto);

      expect(prisma.phoneNumberPricing.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { numberType: PhoneNumberType.MOBILE },
      });
      expect(prisma.orgPhoneNumber.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: 'org-1',
          numberType: PhoneNumberType.MOBILE,
          monthlyPriceInr: 999,
          provisioningStatus: PhoneNumberProvisioningStatus.AWAITING_APPROVAL,
        }),
      });
      expect(result.provisioningStatus).toBe(PhoneNumberProvisioningStatus.AWAITING_APPROVAL);
    });

    it('reuses an existing row when resubmitting after FAILED', async () => {
      const failedRow = makeRow({ provisioningStatus: PhoneNumberProvisioningStatus.FAILED, lastError: 'boom' });
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(failedRow);
      prisma.orgPhoneNumber.update.mockResolvedValue(
        makeRow({ provisioningStatus: PhoneNumberProvisioningStatus.AWAITING_APPROVAL }),
      );

      await phoneNumbers.provision('org-1', dto);

      expect(prisma.orgPhoneNumber.create).not.toHaveBeenCalled();
      expect(prisma.orgPhoneNumber.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'phone-1' } }),
      );
    });
  });

  describe('getStatusForOrg', () => {
    it('throws NotFoundException when no row exists', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(null);
      await expect(phoneNumbers.getStatusForOrg('org-1')).rejects.toThrow(NotFoundException);
    });

    it('includes forwardingInstructions only when source=FORWARDED and PURCHASED', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({
          source: PhoneNumberSource.FORWARDED,
          forwardingFromNumber: '+919999999999',
          phoneNumber: '+911234567890',
          provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
        }),
      );
      const result = await phoneNumbers.getStatusForOrg('org-1');
      expect(result.forwardingInstructions).toContain('+919999999999');
    });

    it('omits forwardingInstructions for a NEW-source number', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({ phoneNumber: '+911234567890', provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED }),
      );
      const result = await phoneNumbers.getStatusForOrg('org-1');
      expect(result.forwardingInstructions).toBeNull();
    });

    it('includes manualRoutingSetup only when routingStatus=MANUAL_SETUP_REQUIRED', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({
          phoneNumber: '+911234567890',
          provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
          routingStatus: PhoneNumberRoutingStatus.MANUAL_SETUP_REQUIRED,
        }),
      );
      const result = await phoneNumbers.getStatusForOrg('org-1');
      expect(result.manualRoutingSetup).not.toBeNull();
    });

    it('omits manualRoutingSetup when routing auto-configured', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({
          phoneNumber: '+911234567890',
          provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
          routingStatus: PhoneNumberRoutingStatus.AUTO_CONFIGURED,
        }),
      );
      const result = await phoneNumbers.getStatusForOrg('org-1');
      expect(result.manualRoutingSetup).toBeNull();
    });
  });

  describe('verifyForwarding', () => {
    it('throws NotFoundException when there is no purchased number', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(null);
      await expect(phoneNumbers.verifyForwarding('org-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the org has no business profile yet', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({ phoneNumber: '+911234567890', provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED }),
      );
      businessProfiles.findByOrgId.mockResolvedValue(null);
      await expect(phoneNumbers.verifyForwarding('org-1')).rejects.toThrow(BadRequestException);
    });

    it('on first call, sets verificationRequestedAt and returns not-verified without checking transcripts', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({ phoneNumber: '+911234567890', provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED }),
      );
      prisma.orgPhoneNumber.update.mockResolvedValue({});

      const result = await phoneNumbers.verifyForwarding('org-1');

      expect(result.verified).toBe(false);
      expect(prisma.orgPhoneNumber.update).toHaveBeenCalledWith({
        where: { id: 'phone-1' },
        data: { verificationRequestedAt: expect.any(Date) },
      });
      expect(prisma.callTranscript.findFirst).not.toHaveBeenCalled();
    });

    it('stays not-verified when no matching transcript has arrived yet', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({
          phoneNumber: '+911234567890',
          provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
          verificationRequestedAt: new Date('2026-09-01T00:00:00Z'),
        }),
      );
      prisma.callTranscript.findFirst.mockResolvedValue(null);

      const result = await phoneNumbers.verifyForwarding('org-1');

      expect(result.verified).toBe(false);
      expect(prisma.orgPhoneNumber.update).not.toHaveBeenCalled();
    });

    it('verifies once a matching transcript is found', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({
          phoneNumber: '+911234567890',
          provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
          verificationRequestedAt: new Date('2026-09-01T00:00:00Z'),
        }),
      );
      prisma.callTranscript.findFirst.mockResolvedValue({ id: 'transcript-1' });
      prisma.orgPhoneNumber.update.mockResolvedValue({ forwardingVerifiedAt: new Date('2026-09-01T00:05:00Z') });

      const result = await phoneNumbers.verifyForwarding('org-1');

      expect(result).toEqual({ verified: true, verifiedAt: '2026-09-01T00:05:00.000Z' });
    });

    it('short-circuits with the cached result once already verified', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({
          phoneNumber: '+911234567890',
          provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
          forwardingVerifiedAt: new Date('2026-09-01T00:05:00Z'),
        }),
      );

      const result = await phoneNumbers.verifyForwarding('org-1');

      expect(result).toEqual({ verified: true, verifiedAt: '2026-09-01T00:05:00.000Z' });
      expect(prisma.callTranscript.findFirst).not.toHaveBeenCalled();
      expect(prisma.orgPhoneNumber.update).not.toHaveBeenCalled();
    });
  });
});
