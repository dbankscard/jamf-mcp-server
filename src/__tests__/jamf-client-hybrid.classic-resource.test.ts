import { describe, expect, it, jest } from '@jest/globals';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';

function makeClient() {
  const client = new JamfApiClientHybrid({
    baseUrl: 'https://example.jamfcloud.com',
    clientId: 'test',
    clientSecret: 'test',
    readOnlyMode: true,
  });
  const get = jest.fn().mockResolvedValue({ data: { computer_check_in: {} } });

  (client as any).ensureAuthenticated = jest.fn().mockResolvedValue(undefined);
  (client as any).axiosInstance = { get };

  return { client, get };
}

describe('getClassicApiResource', () => {
  it('uses the authenticated Classic API transport for an allowlisted resource path', async () => {
    const { client, get } = makeClient();

    await expect(client.getClassicApiResource('computercheckin/id/123')).resolves.toEqual({
      computer_check_in: {},
    });

    expect((client as any).ensureAuthenticated).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      '/JSSResource/computercheckin/id/123',
      { headers: { Accept: 'application/json' } },
    );
  });

  it.each([
    ['a leading slash', '/computercheckin/id/123'],
    ['a query string', 'computercheckin/id/123?subset=General'],
    ['path traversal', 'computercheckin/../activationcode'],
    ['an excluded sensitive resource', 'activationcode'],
    ['an unknown resource', 'not-a-classic-resource/id/123'],
  ])('rejects %s before authenticating or making an API request', async (_caseName, resourcePath) => {
    const { client, get } = makeClient();

    await expect(client.getClassicApiResource(resourcePath)).rejects.toThrow();
    expect((client as any).ensureAuthenticated).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
});
