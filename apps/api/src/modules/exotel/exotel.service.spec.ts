import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExotelApiError, ExotelService } from './exotel.service.js';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

function abortError() {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

describe('ExotelService', () => {
  let exotel: ExotelService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    exotel = new ExotelService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('EXOTEL_API_KEY', 'key');
    vi.stubEnv('EXOTEL_API_TOKEN', 'token');
    vi.stubEnv('EXOTEL_ACCOUNT_SID', 'sid123');
    vi.stubEnv('EXOTEL_API_BASE_URL', 'api.in.exotel.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('purchaseNumber', () => {
    it('throws before calling fetch when Exotel is not configured', async () => {
      vi.stubEnv('EXOTEL_API_KEY', '');
      await expect(exotel.purchaseNumber()).rejects.toThrow('Exotel is not configured');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('searches for an available number then purchases it', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { phone_numbers: [{ phone_number: '+911234567890' }] }))
        .mockResolvedValueOnce(jsonResponse(200, { sid: 'exotel-sid-1', phone_number: '+911234567890' }));

      const result = await exotel.purchaseNumber();

      expect(result).toEqual({ phoneNumber: '+911234567890', exotelSid: 'exotel-sid-1' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1]![0]).toContain('/IncomingPhoneNumbers');
    });

    it('throws ExotelApiError when no numbers are available', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { phone_numbers: [] }));
      await expect(exotel.purchaseNumber()).rejects.toThrow(ExotelApiError);
    });

    it('throws ExotelApiError when the purchase request fails', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { phone_numbers: [{ phone_number: '+911234567890' }] }))
        .mockResolvedValueOnce(jsonResponse(422, { message: 'number no longer available' }));

      await expect(exotel.purchaseNumber()).rejects.toThrow(ExotelApiError);
    });

    it('throws ExotelApiError on a network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      await expect(exotel.purchaseNumber()).rejects.toThrow('network down');
    });

    it('throws ExotelApiError on a timeout', async () => {
      fetchMock.mockRejectedValueOnce(abortError());
      await expect(exotel.purchaseNumber()).rejects.toThrow(/timed out/);
    });
  });

  describe('attachVoicebotApplet', () => {
    const params = { exotelPhoneSid: 'exotel-sid-1', wsUrl: 'wss://voice.sahei.app/ws' };

    it('returns manual_setup_required without calling fetch when Exotel is not configured', async () => {
      vi.stubEnv('EXOTEL_API_KEY', '');
      const result = await exotel.attachVoicebotApplet(params);
      expect(result.status).toBe('manual_setup_required');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns manual_setup_required when no Voicebot flow id is configured', async () => {
      const result = await exotel.attachVoicebotApplet(params);
      expect(result).toEqual({
        status: 'manual_setup_required',
        reason: expect.stringContaining('EXOTEL_VOICEBOT_FLOW_ID'),
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns auto_configured when the flow attaches successfully', async () => {
      vi.stubEnv('EXOTEL_VOICEBOT_FLOW_ID', 'flow-1');
      fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

      const result = await exotel.attachVoicebotApplet(params);

      expect(result).toEqual({ status: 'auto_configured', exotelFlowSid: 'flow-1' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]![0]).toContain('/IncomingPhoneNumbers/exotel-sid-1');
    });

    it('returns manual_setup_required (does not throw) when Exotel rejects the request', async () => {
      vi.stubEnv('EXOTEL_VOICEBOT_FLOW_ID', 'flow-1');
      fetchMock.mockResolvedValueOnce(jsonResponse(400, { message: 'bad flow id' }));

      const result = await exotel.attachVoicebotApplet(params);
      expect(result.status).toBe('manual_setup_required');
    });

    it('returns manual_setup_required (does not throw) on a network error', async () => {
      vi.stubEnv('EXOTEL_VOICEBOT_FLOW_ID', 'flow-1');
      fetchMock.mockRejectedValueOnce(new Error('network down'));

      const result = await exotel.attachVoicebotApplet(params);
      expect(result.status).toBe('manual_setup_required');
    });

    it('returns manual_setup_required (does not throw) on a timeout', async () => {
      vi.stubEnv('EXOTEL_VOICEBOT_FLOW_ID', 'flow-1');
      fetchMock.mockRejectedValueOnce(abortError());

      const result = await exotel.attachVoicebotApplet(params);
      expect(result.status).toBe('manual_setup_required');
    });
  });
});
