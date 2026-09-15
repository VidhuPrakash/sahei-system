import { Injectable, Logger } from '@nestjs/common';

/**
 * Design references (Exotel's REST API isn't fully public-doc'd end to end —
 * confirmed against https://developer.exotel.com/docs/exophones/api-reference/purchase-number
 * and https://developer.exotel.com/docs/agentstream/developer-guide):
 * - Buying a number: `POST /v2_beta/Accounts/{sid}/IncomingPhoneNumbers` with a
 *   form-encoded `PhoneNumber`, confirmed request/response shape.
 * - Routing a number to our bot: Exotel has no per-call Answer-URL webhook.
 *   Inbound calls are routed by a call flow (built once in the Exotel App
 *   Bazaar UI: Call Start -> Voicebot Applet [pointed at VOICE_SERVICE_WS_URL]
 *   -> Hangup) reachable at `https://my.exotel.com/{sid}/exoml/start_voice/{flowId}`.
 *   That flow's id (EXOTEL_VOICEBOT_FLOW_ID) is a one-time, per-account manual
 *   setup — there is no documented API to create the flow itself. What *is*
 *   documented is attaching an existing flow to a number via its `VoiceUrl`,
 *   which this service automates per newly purchased number.
 * - The "browse available numbers to buy" endpoint exists (referenced from
 *   Exotel's docs navigation) but its exact query shape didn't resolve during
 *   research — `findAvailableNumber` below follows the IncomingPhoneNumbers
 *   REST convention and should be confirmed against Exotel's Available
 *   Numbers API reference before depending on it in production.
 */

export class ExotelApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly exotelBody: unknown,
  ) {
    super(message);
    this.name = 'ExotelApiError';
  }
}

export interface ExotelPurchasedNumber {
  phoneNumber: string;
  exotelSid: string;
}

export type ExotelRoutingResult =
  | { status: 'auto_configured'; exotelFlowSid: string }
  | { status: 'manual_setup_required'; reason: string };

interface ExotelConfig {
  apiKey: string;
  apiToken: string;
  accountSid: string;
  baseUrl: string;
}

interface ExotelIncomingNumberResponse {
  sid: string;
  phone_number: string;
}

interface ExotelAvailableNumbersResponse {
  phone_numbers?: { phone_number: string }[];
}

const REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class ExotelService {
  private readonly logger = new Logger(ExotelService.name);

  async purchaseNumber(): Promise<ExotelPurchasedNumber> {
    const config = this.requireConfig();
    const candidate = await this.findAvailableNumber(config);
    const purchased = await this.request<ExotelIncomingNumberResponse>(config, '/IncomingPhoneNumbers', {
      method: 'POST',
      body: new URLSearchParams({ PhoneNumber: candidate, FriendlyName: candidate }),
    });
    return { phoneNumber: purchased.phone_number, exotelSid: purchased.sid };
  }

  /**
   * Attaches the pre-built Voicebot flow (EXOTEL_VOICEBOT_FLOW_ID) to a
   * purchased number. Never throws for expected failure modes — any missing
   * config, non-2xx response, or network error becomes
   * `manual_setup_required` so a routing hiccup never blocks the purchase
   * from being usable; the admin can wire the number by hand instead.
   */
  async attachVoicebotApplet(params: { exotelPhoneSid: string; wsUrl: string }): Promise<ExotelRoutingResult> {
    let config: ExotelConfig;
    try {
      config = this.requireConfig();
    } catch (error) {
      return { status: 'manual_setup_required', reason: (error as Error).message };
    }

    const flowId = process.env.EXOTEL_VOICEBOT_FLOW_ID;
    if (!flowId) {
      return {
        status: 'manual_setup_required',
        reason: `EXOTEL_VOICEBOT_FLOW_ID is not configured — create a Voicebot flow in Exotel's App Bazaar pointed at ${params.wsUrl} and set its flow id`,
      };
    }

    try {
      await this.request(config, `/IncomingPhoneNumbers/${params.exotelPhoneSid}`, {
        method: 'POST',
        body: new URLSearchParams({
          VoiceUrl: `https://my.exotel.com/${config.accountSid}/exoml/start_voice/${flowId}`,
        }),
      });
      return { status: 'auto_configured', exotelFlowSid: flowId };
    } catch (error) {
      const reason =
        error instanceof ExotelApiError
          ? `Exotel returned ${error.status} attaching the Voicebot flow`
          : (error as Error).message;
      this.logger.warn(`Falling back to manual routing setup for ${params.exotelPhoneSid}: ${reason}`);
      return { status: 'manual_setup_required', reason };
    }
  }

  private async findAvailableNumber(config: ExotelConfig): Promise<string> {
    const result = await this.request<ExotelAvailableNumbersResponse>(
      config,
      '/IncomingPhoneNumbers/available',
      { method: 'GET' },
    );
    const candidate = result.phone_numbers?.[0]?.phone_number;
    if (!candidate) {
      throw new ExotelApiError('No available Exotel numbers to purchase', 200, result);
    }
    return candidate;
  }

  private requireConfig(): ExotelConfig {
    const apiKey = process.env.EXOTEL_API_KEY;
    const apiToken = process.env.EXOTEL_API_TOKEN;
    const accountSid = process.env.EXOTEL_ACCOUNT_SID;
    const baseUrl = process.env.EXOTEL_API_BASE_URL;
    if (!apiKey || !apiToken || !accountSid || !baseUrl) {
      throw new Error('Exotel is not configured');
    }
    return { apiKey, apiToken, accountSid, baseUrl };
  }

  private async request<T>(config: ExotelConfig, path: string, init: RequestInit): Promise<T> {
    const url = `https://${config.baseUrl}/v2_beta/Accounts/${config.accountSid}${path}`;
    const authorization = `Basic ${Buffer.from(`${config.apiKey}:${config.apiToken}`).toString('base64')}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Authorization: authorization,
          ...(init.body instanceof URLSearchParams
            ? { 'Content-Type': 'application/x-www-form-urlencoded' }
            : {}),
        },
        signal: controller.signal,
      });

      const raw = await response.text();
      const body = raw ? this.parseBody(raw) : undefined;

      if (!response.ok) {
        throw new ExotelApiError(`Exotel request to ${path} failed`, response.status, body);
      }
      return body as T;
    } catch (error) {
      if (error instanceof ExotelApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ExotelApiError(`Exotel request to ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`, 0, undefined);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseBody(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
}
