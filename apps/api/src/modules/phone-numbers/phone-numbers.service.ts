import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { OrgPhoneNumber } from '@prisma/client';
import { PhoneNumberProvisioningStatus, PhoneNumberRoutingStatus, PhoneNumberSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BusinessProfileService } from '../business-profile/business-profile.service.js';
import type { ExotelRoutingResult } from '../exotel/exotel.service.js';
import { ExotelService } from '../exotel/exotel.service.js';
import type { ProvisionPhoneNumberDto } from './dto/provision-phone-number.dto.js';

// A fresh row stuck in PENDING longer than this is treated as a crashed
// attempt and reused, rather than blocking a retry indefinitely.
const STALE_PENDING_MS = 2 * 60 * 1000;

export interface PhoneNumberStatusResponse {
  phoneNumber: string | null;
  source: PhoneNumberSource;
  provisioningStatus: PhoneNumberProvisioningStatus;
  routingStatus: PhoneNumberRoutingStatus;
  lastError: string | null;
  forwardingInstructions: string | null;
  manualRoutingSetup: { wsUrl: string; instructions: string } | null;
  verification: { requestedAt: string | null; verifiedAt: string | null };
}

export interface VerifyForwardingResponse {
  verified: boolean;
  verifiedAt?: string;
  message?: string;
}

function buildForwardingInstructions(forwardingFromNumber: string, phoneNumber: string): string {
  return [
    `Forward calls from your existing number (${forwardingFromNumber}) to your new SaHei number (${phoneNumber}):`,
    `1. Open the dialer on the phone that uses ${forwardingFromNumber}.`,
    `2. Dial **21*${phoneNumber}# and press call to enable unconditional call forwarding (works on most Indian GSM carriers — confirm with your carrier if it doesn't take).`,
    `3. Make a test call to ${forwardingFromNumber} from another phone, then come back here and click "Verify".`,
    'To turn forwarding off later, dial ##21#.',
  ].join('\n');
}

function buildManualRoutingInstructions(wsUrl: string): string {
  return [
    'Automatic call routing could not be configured for this number.',
    'In the Exotel dashboard, open App Bazaar and create (or reuse) a flow: Call Start -> Voicebot Applet -> Hangup,',
    `then set the Voicebot Applet's WebSocket URL to: ${wsUrl}`,
    'Finally, attach that flow to this number under ExoPhones.',
  ].join('\n');
}

@Injectable()
export class PhoneNumbersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exotel: ExotelService,
    private readonly businessProfiles: BusinessProfileService,
  ) {}

  async provision(orgId: string, dto: ProvisionPhoneNumberDto): Promise<PhoneNumberStatusResponse> {
    const existing = await this.prisma.orgPhoneNumber.findFirst({ where: { orgId } });

    if (existing?.provisioningStatus === PhoneNumberProvisioningStatus.PURCHASED) {
      throw new ConflictException('This organization already has a phone number');
    }
    if (
      existing?.provisioningStatus === PhoneNumberProvisioningStatus.PENDING &&
      Date.now() - existing.updatedAt.getTime() < STALE_PENDING_MS
    ) {
      throw new ConflictException('Phone number provisioning is already in progress');
    }

    const row = existing
      ? await this.prisma.orgPhoneNumber.update({
          where: { id: existing.id },
          data: {
            source: dto.source,
            forwardingFromNumber: dto.forwardingFromNumber ?? null,
            provisioningStatus: PhoneNumberProvisioningStatus.PENDING,
            lastError: null,
          },
        })
      : await this.prisma.orgPhoneNumber.create({
          data: { orgId, source: dto.source, forwardingFromNumber: dto.forwardingFromNumber ?? null },
        });

    const purchased = await this.exotel.purchaseNumber().catch(async (error: Error) => {
      await this.prisma.orgPhoneNumber.update({
        where: { id: row.id },
        data: { provisioningStatus: PhoneNumberProvisioningStatus.FAILED, lastError: error.message },
      });
      throw new BadGatewayException('Failed to purchase a phone number from Exotel');
    });

    const routing = await this.attemptRouting(purchased.exotelSid);

    const updated = await this.prisma.orgPhoneNumber.update({
      where: { id: row.id },
      data: {
        phoneNumber: purchased.phoneNumber,
        exotelPhoneSid: purchased.exotelSid,
        provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
        routingStatus:
          routing.status === 'auto_configured'
            ? PhoneNumberRoutingStatus.AUTO_CONFIGURED
            : PhoneNumberRoutingStatus.MANUAL_SETUP_REQUIRED,
        exotelFlowSid: routing.status === 'auto_configured' ? routing.exotelFlowSid : null,
        lastError: routing.status === 'manual_setup_required' ? routing.reason : null,
      },
    });

    return this.toStatusResponse(updated);
  }

  async getStatusForOrg(orgId: string): Promise<PhoneNumberStatusResponse> {
    const row = await this.prisma.orgPhoneNumber.findFirst({ where: { orgId } });
    if (!row) {
      throw new NotFoundException('No phone number provisioned for this organization');
    }
    return this.toStatusResponse(row);
  }

  async verifyForwarding(orgId: string): Promise<VerifyForwardingResponse> {
    const row = await this.prisma.orgPhoneNumber.findFirst({ where: { orgId } });
    if (!row || row.provisioningStatus !== PhoneNumberProvisioningStatus.PURCHASED) {
      throw new NotFoundException('No purchased phone number for this organization');
    }

    const business = await this.businessProfiles.findByOrgId(orgId);
    if (!business) {
      throw new BadRequestException('Complete your business profile before verifying call routing');
    }

    if (row.forwardingVerifiedAt) {
      return { verified: true, verifiedAt: row.forwardingVerifiedAt.toISOString() };
    }

    if (!row.verificationRequestedAt) {
      await this.prisma.orgPhoneNumber.update({
        where: { id: row.id },
        data: { verificationRequestedAt: new Date() },
      });
      return { verified: false, message: `Make a call to ${row.phoneNumber} now, then check again in ~30s` };
    }

    const transcript = await this.prisma.callTranscript.findFirst({
      where: { businessId: business.id, createdAt: { gte: row.verificationRequestedAt } },
      orderBy: { createdAt: 'asc' },
    });

    if (!transcript) {
      return { verified: false, message: 'No call received yet — try again in a few seconds' };
    }

    const verified = await this.prisma.orgPhoneNumber.update({
      where: { id: row.id },
      data: { forwardingVerifiedAt: new Date() },
    });

    return { verified: true, verifiedAt: verified.forwardingVerifiedAt!.toISOString() };
  }

  private async attemptRouting(exotelPhoneSid: string): Promise<ExotelRoutingResult> {
    const wsUrl = process.env.VOICE_SERVICE_WS_URL;
    if (!wsUrl) {
      return { status: 'manual_setup_required', reason: 'VOICE_SERVICE_WS_URL is not configured' };
    }
    try {
      return await this.exotel.attachVoicebotApplet({ exotelPhoneSid, wsUrl });
    } catch (error) {
      return { status: 'manual_setup_required', reason: (error as Error).message };
    }
  }

  private toStatusResponse(row: OrgPhoneNumber): PhoneNumberStatusResponse {
    const wsUrl = process.env.VOICE_SERVICE_WS_URL;
    return {
      phoneNumber: row.phoneNumber,
      source: row.source,
      provisioningStatus: row.provisioningStatus,
      routingStatus: row.routingStatus,
      lastError: row.lastError,
      forwardingInstructions:
        row.source === PhoneNumberSource.FORWARDED &&
        row.provisioningStatus === PhoneNumberProvisioningStatus.PURCHASED &&
        row.forwardingFromNumber &&
        row.phoneNumber
          ? buildForwardingInstructions(row.forwardingFromNumber, row.phoneNumber)
          : null,
      manualRoutingSetup:
        row.routingStatus === PhoneNumberRoutingStatus.MANUAL_SETUP_REQUIRED && wsUrl
          ? { wsUrl, instructions: buildManualRoutingInstructions(wsUrl) }
          : null,
      verification: {
        requestedAt: row.verificationRequestedAt?.toISOString() ?? null,
        verifiedAt: row.forwardingVerifiedAt?.toISOString() ?? null,
      },
    };
  }
}
