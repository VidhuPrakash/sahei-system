import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { OrgPhoneNumber, PhoneNumberType } from '@prisma/client';
import { PhoneNumberProvisioningStatus, PhoneNumberRoutingStatus, PhoneNumberSource } from '@prisma/client';
import type { PhoneNumberPricing as PhoneNumberPricingType } from '@sahei/types';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BusinessProfileService } from '../business-profile/business-profile.service.js';
import type { ExotelRoutingResult } from '../exotel/exotel.service.js';
import { ExotelService } from '../exotel/exotel.service.js';
import type { ProvisionPhoneNumberDto } from './dto/provision-phone-number.dto.js';

export interface PhoneNumberStatusResponse {
  phoneNumber: string | null;
  source: PhoneNumberSource;
  numberType: PhoneNumberType | null;
  monthlyPriceInr: number | null;
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

  async listPricing(): Promise<PhoneNumberPricingType[]> {
    const rows = await this.prisma.phoneNumberPricing.findMany();
    return rows.map((row) => ({ numberType: row.numberType, monthlyPriceInr: Number(row.monthlyPriceInr) }));
  }

  async provision(orgId: string, dto: ProvisionPhoneNumberDto): Promise<PhoneNumberStatusResponse> {
    const existing = await this.prisma.orgPhoneNumber.findFirst({ where: { orgId } });

    if (existing?.provisioningStatus === PhoneNumberProvisioningStatus.PURCHASED) {
      throw new ConflictException('This organization already has a phone number');
    }
    if (existing?.provisioningStatus === PhoneNumberProvisioningStatus.AWAITING_APPROVAL) {
      throw new ConflictException('Your phone number request is already awaiting approval');
    }

    const pricing = await this.prisma.phoneNumberPricing.findUniqueOrThrow({
      where: { numberType: dto.numberType },
    });

    const data = {
      source: dto.source,
      forwardingFromNumber: dto.forwardingFromNumber ?? null,
      numberType: dto.numberType,
      monthlyPriceInr: pricing.monthlyPriceInr,
      provisioningStatus: PhoneNumberProvisioningStatus.AWAITING_APPROVAL,
      lastError: null,
    };

    const row = existing
      ? await this.prisma.orgPhoneNumber.update({ where: { id: existing.id }, data })
      : await this.prisma.orgPhoneNumber.create({ data: { orgId, ...data } });

    return this.toStatusResponse(row);
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

  // Not called by provision() — this org-facing flow only records a request
  // (see provision() above); a future admin session's fulfillment action
  // will call exotel.purchaseNumber() then this method before marking the
  // row PURCHASED.
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
      numberType: row.numberType,
      monthlyPriceInr: row.monthlyPriceInr ? Number(row.monthlyPriceInr) : null,
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
