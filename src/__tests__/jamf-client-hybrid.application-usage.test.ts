import { describe, expect, it, jest } from '@jest/globals';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';

function makeClient() {
  const client = new JamfApiClientHybrid({
    baseUrl: 'https://example.jamfcloud.com',
    clientId: 'test',
    clientSecret: 'test',
    readOnlyMode: true,
  });
  const get = jest.fn().mockResolvedValue({ data: { computer_application_usage: {} } });

  (client as any).ensureAuthenticated = jest.fn().mockResolvedValue(undefined);
  (client as any).axiosInstance = { get };

  return { client, get };
}

describe('getComputerApplicationUsage', () => {
  it('uses the authenticated Classic API transport with the required endpoint and Accept header', async () => {
    const { client, get } = makeClient();

    await expect(client.getComputerApplicationUsage('123', '2026-01-01', '2026-01-31')).resolves.toEqual({
      computer_application_usage: {},
    });

    expect((client as any).ensureAuthenticated).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      '/JSSResource/computerapplicationusage/id/123/2026-01-01_2026-01-31',
      { headers: { Accept: 'application/json' } },
    );
  });

  it.each([
    ['non-numeric device ID', 'abc', '2026-01-01', '2026-01-31', 'deviceId must be a numeric Jamf computer ID'],
    ['invalid start date', '123', '01-01-2026', '2026-01-31', 'startDate must use YYYY-MM-DD format'],
    ['invalid end date', '123', '2026-01-01', '2026/01/31', 'endDate must use YYYY-MM-DD format'],
  ])('rejects %s before making an API request', async (_caseName, deviceId, startDate, endDate, message) => {
    const { client, get } = makeClient();

    await expect(client.getComputerApplicationUsage(deviceId, startDate, endDate)).rejects.toThrow(message);
    expect((client as any).ensureAuthenticated).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
});
