import { describe, expect, it, jest } from '@jest/globals';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';

/**
 * Regression test for the fleet-truncation bug: searchComputers used to fetch a
 * single page (page-size=limit) and return only response.data.results, silently
 * capping any fleet larger than the limit. It now walks pages up to totalCount.
 */
function makeClient(totalCount: number) {
  const client = new JamfApiClientHybrid({
    baseUrl: 'https://example.jamfcloud.com',
    clientId: 'test',
    clientSecret: 'test',
    readOnlyMode: true,
  } as any);

  // Skip real auth. Serve sequential ids page by page, honouring page-size and
  // stopping at totalCount — the same shape the Jamf Pro API returns.
  (client as any).ensureAuthenticated = jest.fn(async () => {});
  const calls: any[] = [];
  let cursor = 0;
  const get = jest.fn(async (_url: string, opts: any) => {
    calls.push(opts.params);
    const size = opts.params['page-size'] as number;
    const results: any[] = [];
    for (let i = 0; i < size && cursor < totalCount; i++) {
      results.push({ id: String(cursor++), general: { name: `Mac-${cursor}` } });
    }
    return { data: { totalCount, results } };
  });
  (client as any).axiosInstance = { get };
  return { client, calls };
}

describe('searchComputers pagination', () => {
  it('walks every page and returns the whole fleet, not just the first page', async () => {
    // 4,500 devices → 3 pages of 2000/2000/500 (mirrors the real 3,612 case)
    const { client, calls } = makeClient(4500);

    const all = await client.getAllComputers();

    expect(all).toHaveLength(4500); // was capped at 1000 before the fix
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => c.page)).toEqual([0, 1, 2]);
    expect(calls[0].sort).toBe('id:asc'); // stable order across pages
  });

  it('stops at the caller limit without over-fetching', async () => {
    const { client, calls } = makeClient(5000);

    const some = await client.searchComputers('', 2);

    expect(some).toHaveLength(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]['page-size']).toBe(2);
  });
});
