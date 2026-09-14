import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallTranscriptsService } from './call-transcripts.service.js';

function makePrismaMock() {
  return {
    callTranscript: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
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
});
