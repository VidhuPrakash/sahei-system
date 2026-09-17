import { Injectable, NotFoundException } from '@nestjs/common';
import type { CallOutcome, CallTranscript } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCallTranscriptDto } from './dto/create-call-transcript.dto.js';

@Injectable()
export class CallTranscriptsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCallTranscriptDto): Promise<CallTranscript> {
    const data = {
      businessId: dto.businessId,
      callId: dto.callId,
      customerPhone: dto.customerPhone,
      outcome: dto.outcome,
      // A booking reference only means something for a call that actually
      // booked — null it out rather than trust the caller not to send one
      // alongside INQUIRY/NO_OUTCOME.
      bookingReference: dto.outcome === 'BOOKED' ? dto.bookingReference : null,
      transcript: dto.transcript as unknown as Prisma.InputJsonValue,
      startedAt: new Date(dto.startedAt),
      endedAt: new Date(dto.endedAt),
    };

    // callId is unique — upsert so a retried POST (e.g. voice-service
    // crash-retry) overwrites the same row instead of hitting a constraint error.
    return this.prisma.callTranscript.upsert({
      where: { callId: dto.callId },
      create: data,
      update: data,
    });
  }

  async findByCallId(callId: string): Promise<CallTranscript> {
    const transcript = await this.prisma.callTranscript.findUnique({
      where: { callId },
    });
    if (!transcript) {
      throw new NotFoundException(`No call transcript with callId ${callId}`);
    }
    return transcript;
  }

  findByOrgId(orgId: string, filters: { outcome?: CallOutcome; q?: string } = {}): Promise<CallTranscript[]> {
    return this.prisma.callTranscript.findMany({
      where: {
        business: { orgId },
        ...(filters.outcome ? { outcome: filters.outcome } : {}),
        ...(filters.q
          ? {
              OR: [
                { customerPhone: { contains: filters.q, mode: 'insensitive' } },
                { callId: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { startedAt: 'desc' },
    });
  }
}
