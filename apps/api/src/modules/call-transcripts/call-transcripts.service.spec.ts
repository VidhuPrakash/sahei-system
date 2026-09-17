import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallTranscriptsService } from './call-transcripts.service.js';

function makePrismaMock() {
  return {
    callTranscript: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

describe('CallTranscriptsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let callTranscripts: CallTranscriptsService;

  const dto = {
    businessId: 'business-1',
    callId: 'call-1',
    customerPhone: '+919999999999',
    outcome: 'BOOKED' as const,
    bookingReference: 'ABCD1234',
    transcript: [{ role: 'user', content: 'hi' }],
    startedAt: '2026-09-15T04:00:00.000Z',
    endedAt: '2026-09-15T04:05:00.000Z',
  };

  beforeEach(() => {
    prisma = makePrismaMock();
    callTranscripts = new CallTranscriptsService(prisma as never);
  });

  describe('create', () => {
    it('upserts on callId so a retried post overwrites the same row', async () => {
      prisma.callTranscript.upsert.mockResolvedValue({ id: 'ct-1', ...dto });
      await callTranscripts.create(dto);

      expect(prisma.callTranscript.upsert).toHaveBeenCalledWith({
        where: { callId: 'call-1' },
        create: expect.objectContaining({
          businessId: 'business-1',
          callId: 'call-1',
          outcome: 'BOOKED',
          startedAt: new Date(dto.startedAt),
          endedAt: new Date(dto.endedAt),
        }),
        update: expect.objectContaining({
          businessId: 'business-1',
          callId: 'call-1',
        }),
      });
    });

    it('nulls out bookingReference for an outcome other than BOOKED', async () => {
      const inquiryDto = { ...dto, outcome: 'INQUIRY' as const, bookingReference: 'SHOULD-BE-DROPPED' };
      prisma.callTranscript.upsert.mockResolvedValue({ id: 'ct-1', ...inquiryDto, bookingReference: null });
      await callTranscripts.create(inquiryDto);

      expect(prisma.callTranscript.upsert).toHaveBeenCalledWith({
        where: { callId: 'call-1' },
        create: expect.objectContaining({ outcome: 'INQUIRY', bookingReference: null }),
        update: expect.objectContaining({ outcome: 'INQUIRY', bookingReference: null }),
      });
    });
  });

  describe('findByCallId', () => {
    it('throws NotFoundException when no transcript matches', async () => {
      prisma.callTranscript.findUnique.mockResolvedValue(null);
      await expect(callTranscripts.findByCallId('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the transcript when found', async () => {
      const record = { id: 'ct-1', ...dto };
      prisma.callTranscript.findUnique.mockResolvedValue(record);
      await expect(callTranscripts.findByCallId('call-1')).resolves.toEqual(
        record,
      );
    });
  });

  describe('findByOrgId', () => {
    it('scopes the query to the org via the business relation, newest first', async () => {
      prisma.callTranscript.findMany.mockResolvedValue([]);
      await callTranscripts.findByOrgId('org-1');

      expect(prisma.callTranscript.findMany).toHaveBeenCalledWith({
        where: { business: { orgId: 'org-1' } },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('applies an outcome filter when provided', async () => {
      prisma.callTranscript.findMany.mockResolvedValue([]);
      await callTranscripts.findByOrgId('org-1', { outcome: 'BOOKED' });

      expect(prisma.callTranscript.findMany).toHaveBeenCalledWith({
        where: { business: { orgId: 'org-1' }, outcome: 'BOOKED' },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('applies a free-text filter against customerPhone and callId when provided', async () => {
      prisma.callTranscript.findMany.mockResolvedValue([]);
      await callTranscripts.findByOrgId('org-1', { q: '999' });

      expect(prisma.callTranscript.findMany).toHaveBeenCalledWith({
        where: {
          business: { orgId: 'org-1' },
          OR: [
            { customerPhone: { contains: '999', mode: 'insensitive' } },
            { callId: { contains: '999', mode: 'insensitive' } },
          ],
        },
        orderBy: { startedAt: 'desc' },
      });
    });
  });
});
