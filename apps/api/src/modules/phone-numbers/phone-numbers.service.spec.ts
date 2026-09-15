import { BadGatewayException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PhoneNumberProvisioningStatus, PhoneNumberRoutingStatus, PhoneNumberSource } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneNumbersService } from './phone-numbers.service.js';

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'phone-1',
    orgId: 'org-1',
    phoneNumber: null,
    source: PhoneNumberSource.NEW,
    forwardingFromNumber: null,
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

function makePrismaMock() {
  return {
    orgPhoneNumber: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    callTranscript: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

describe('PhoneNumbersService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let exotel: { purchaseNumber: ReturnType<typeof vi.fn>; attachVoicebotApplet: ReturnType<typeof vi.fn> };
  let businessProfiles: { findByOrgId: ReturnType<typeof vi.fn> };
  let phoneNumbers: PhoneNumbersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    exotel = { purchaseNumber: vi.fn(), attachVoicebotApplet: vi.fn() };
    businessProfiles = { findByOrgId: vi.fn().mockResolvedValue({ id: 'business-1', orgId: 'org-1' }) };
    phoneNumbers = new PhoneNumbersService(prisma as never, exotel as never, businessProfiles as never);
    vi.stubEnv('VOICE_SERVICE_WS_URL', 'wss://voice.sahei.app/ws');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('provision', () => {
    const dto = { source: PhoneNumberSource.NEW } as never;

    it('throws ConflictException when the org already has a purchased number', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({ provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED, phoneNumber: '+911111111111' }),
      );
      await expect(phoneNumbers.provision('org-1', dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when a recent PENDING attempt is already running', async () => {
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(
        makeRow({ provisioningStatus: PhoneNumberProvisioningStatus.PENDING, updatedAt: new Date() }),
      );
      await expect(phoneNumbers.provision('org-1', dto)).rejects.toThrow(ConflictException);
    });

    it('reuses a stale PENDING row instead of creating a new one', async () => {
      const staleRow = makeRow({
        provisioningStatus: PhoneNumberProvisioningStatus.PENDING,
        updatedAt: new Date('2020-01-01T00:00:00Z'),
      });
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(staleRow);
      prisma.orgPhoneNumber.update.mockResolvedValueOnce(staleRow).mockResolvedValueOnce(
        makeRow({
          phoneNumber: '+911234567890',
          exotelPhoneSid: 'exotel-sid-1',
          provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
          routingStatus: PhoneNumberRoutingStatus.AUTO_CONFIGURED,
          exotelFlowSid: 'flow-1',
        }),
      );
      exotel.purchaseNumber.mockResolvedValue({ phoneNumber: '+911234567890', exotelSid: 'exotel-sid-1' });
      exotel.attachVoicebotApplet.mockResolvedValue({ status: 'auto_configured', exotelFlowSid: 'flow-1' });

      await phoneNumbers.provision('org-1', dto);

      expect(prisma.orgPhoneNumber.create).not.toHaveBeenCalled();
      expect(prisma.orgPhoneNumber.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'phone-1' } }),
      );
    });

    it('reuses a FAILED row for a retry', async () => {
      const failedRow = makeRow({ provisioningStatus: PhoneNumberProvisioningStatus.FAILED, lastError: 'boom' });
      prisma.orgPhoneNumber.findFirst.mockResolvedValue(failedRow);
      prisma.orgPhoneNumber.update.mockResolvedValueOnce(failedRow).mockResolvedValueOnce(
        makeRow({
          phoneNumber: '+911234567890',
          exotelPhoneSid: 'exotel-sid-1',
          provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
          routingStatus: PhoneNumberRoutingStatus.AUTO_CONFIGURED,
          exotelFlowSid: 'flow-1',
        }),
      );
      exotel.purchaseNumber.mockResolvedValue({ phoneNumber: '+911234567890', exotelSid: 'exotel-sid-1' });
      exotel.attachVoicebotApplet.mockResolvedValue({ status: 'auto_configured', exotelFlowSid: 'flow-1' });

      await phoneNumbers.provision('org-1', dto);

      expect(prisma.orgPhoneNumber.create).not.toHaveBeenCalled();
    });

    it('marks the row FAILED and rethrows BadGatewayException when Exotel purchase fails', async () => {
      prisma.orgPhoneNumber.create.mockResolvedValue(makeRow());
      exotel.purchaseNumber.mockRejectedValue(new Error('Exotel is not configured'));

      await expect(phoneNumbers.provision('org-1', dto)).rejects.toThrow(BadGatewayException);
      expect(prisma.orgPhoneNumber.update).toHaveBeenCalledWith({
        where: { id: 'phone-1' },
        data: { provisioningStatus: PhoneNumberProvisioningStatus.FAILED, lastError: 'Exotel is not configured' },
      });
    });

    it('resolves PURCHASED/AUTO_CONFIGURED when purchase and routing both succeed', async () => {
      prisma.orgPhoneNumber.create.mockResolvedValue(makeRow());
      exotel.purchaseNumber.mockResolvedValue({ phoneNumber: '+911234567890', exotelSid: 'exotel-sid-1' });
      exotel.attachVoicebotApplet.mockResolvedValue({ status: 'auto_configured', exotelFlowSid: 'flow-1' });
      prisma.orgPhoneNumber.update.mockResolvedValue(
        makeRow({
          phoneNumber: '+911234567890',
          exotelPhoneSid: 'exotel-sid-1',
          provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
          routingStatus: PhoneNumberRoutingStatus.AUTO_CONFIGURED,
          exotelFlowSid: 'flow-1',
        }),
      );

      const result = await phoneNumbers.provision('org-1', dto);

      expect(result.provisioningStatus).toBe(PhoneNumberProvisioningStatus.PURCHASED);
      expect(result.routingStatus).toBe(PhoneNumberRoutingStatus.AUTO_CONFIGURED);
    });

    it('resolves (does not throw) PURCHASED/MANUAL_SETUP_REQUIRED when routing falls back to manual', async () => {
      prisma.orgPhoneNumber.create.mockResolvedValue(makeRow());
      exotel.purchaseNumber.mockResolvedValue({ phoneNumber: '+911234567890', exotelSid: 'exotel-sid-1' });
      exotel.attachVoicebotApplet.mockResolvedValue({
        status: 'manual_setup_required',
        reason: 'EXOTEL_VOICEBOT_FLOW_ID is not configured',
      });
      prisma.orgPhoneNumber.update.mockResolvedValue(
        makeRow({
          phoneNumber: '+911234567890',
          exotelPhoneSid: 'exotel-sid-1',
          provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
          routingStatus: PhoneNumberRoutingStatus.MANUAL_SETUP_REQUIRED,
          lastError: 'EXOTEL_VOICEBOT_FLOW_ID is not configured',
        }),
      );

      const result = await phoneNumbers.provision('org-1', dto);

      expect(result.provisioningStatus).toBe(PhoneNumberProvisioningStatus.PURCHASED);
      expect(result.routingStatus).toBe(PhoneNumberRoutingStatus.MANUAL_SETUP_REQUIRED);
      expect(result.manualRoutingSetup).toEqual({
        wsUrl: 'wss://voice.sahei.app/ws',
        instructions: expect.any(String),
      });
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
