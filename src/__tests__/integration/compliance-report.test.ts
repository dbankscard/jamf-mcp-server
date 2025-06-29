import { jest } from '@jest/globals';
import { JamfApiClient } from '../../jamf-client';
import { createMockAxios } from '../helpers/mock-axios';
import { 
  mockModernComputerSearchResponse,
  mockComplianceReportData 
} from '../fixtures/computer-responses';
import { createTestDates, createMockComputerList } from '../helpers/test-utils';

describe('Compliance Report Integration', () => {
  let client: JamfApiClient;
  let mockAdapter: ReturnType<typeof createMockAxios>['adapter'];

  beforeEach(() => {
    const { axios, adapter } = createMockAxios({ 
      baseURL: 'https://test.jamfcloud.com',
      autoAuth: true 
    });
    mockAdapter = adapter;
    
    jest.spyOn(require('axios'), 'create').mockReturnValue(axios);
    
    client = new JamfApiClient({
      baseUrl: 'https://test.jamfcloud.com',
      username: 'testuser',
      password: 'testpass',
      readOnlyMode: true
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getComplianceReport', () => {
    test('should generate compliance report for 30 days by default', async () => {
      // Create mock data with various last contact times
      const { now, lastWeek, lastMonth } = createTestDates();
      const mockComputers = [
        {
          ...mockModernComputerSearchResponse.results[0],
          general: { lastContactTime: now.toISOString() }
        },
        {
          ...mockModernComputerSearchResponse.results[1],
          general: { lastContactTime: lastWeek.toISOString() }
        },
        {
          id: '3',
          name: 'Outdated-Computer',
          general: { 
            name: 'Outdated-Computer',
            lastContactTime: new Date('2024-10-01').toISOString() 
          }
        }
      ];

      mockAdapter.addMockResponse('GET', '/api/v1/computers-inventory', {
        status: 200,
        data: { results: mockComputers }
      });

      const report = await client.getComplianceReport();

      expect(report.total).toBe(3);
      expect(report.compliant).toBe(2); // Only first two are within 30 days
      expect(report.notReporting).toBe(1);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].computerName).toBe('Outdated-Computer');
    });

    test('should handle custom day ranges', async () => {
      const mockComputers = createMockComputerList(10).map((computer, index) => ({
        ...computer,
        general: {
          name: computer.name,
          lastContactTime: new Date(Date.now() - (index * 5 * 86400000)).toISOString() // 5 days apart
        }
      }));

      mockAdapter.addMockResponse('GET', '/api/v1/computers-inventory', {
        status: 200,
        data: { results: mockComputers }
      });

      const report = await client.getComplianceReport(7); // 7 days

      // Only computers 0 and 1 should be compliant (0 and 5 days ago)
      expect(report.compliant).toBe(2);
      expect(report.notReporting).toBe(8);
    });

    test('should handle computers with missing contact times', async () => {
      const mockComputers = [
        {
          id: '1',
          name: 'Normal-Computer',
          general: { 
            name: 'Normal-Computer',
            lastContactTime: new Date().toISOString() 
          }
        },
        {
          id: '2',
          name: 'Never-Contacted',
          general: { 
            name: 'Never-Contacted',
            lastContactTime: null 
          }
        },
        {
          id: '3',
          name: 'No-General-Section',
          // No general section at all
        }
      ];

      mockAdapter.addMockResponse('GET', '/api/v1/computers-inventory', {
        status: 200,
        data: { results: mockComputers }
      });

      const report = await client.getComplianceReport();

      expect(report.total).toBe(3);
      expect(report.compliant).toBe(1);
      expect(report.notReporting).toBe(2);
      expect(report.issues).toHaveLength(2);
      
      const neverContactedIssue = report.issues.find(i => i.computerName === 'Never-Contacted');
      expect(neverContactedIssue?.lastContact).toBe('Never');
    });

    test('should sort results by last contact time', async () => {
      mockAdapter.addMockResponse('GET', '/api/v1/computers-inventory', {
        status: 200,
        data: mockModernComputerSearchResponse
      });

      await client.getComplianceReport();

      const request = mockAdapter.getLastRequest();
      expect(request?.params?.sort).toBe('general.lastContactTime:desc');
    });

    test('should handle API errors gracefully', async () => {
      mockAdapter.addMockResponse('GET', '/api/v1/computers-inventory', {
        status: 500,
        data: { error: 'Internal Server Error' }
      });

      await expect(client.getComplianceReport()).rejects.toThrow();
    });

    test('should handle large datasets', async () => {
      const largeDataset = createMockComputerList(1000).map((computer, index) => ({
        ...computer,
        general: {
          name: computer.name,
          lastContactTime: index % 100 < 50 
            ? new Date().toISOString() // 50% compliant
            : new Date('2024-01-01').toISOString() // 50% non-compliant
        }
      }));

      mockAdapter.addMockResponse('GET', '/api/v1/computers-inventory', {
        status: 200,
        data: { results: largeDataset }
      });

      const report = await client.getComplianceReport();

      expect(report.total).toBe(1000);
      expect(report.compliant).toBe(500);
      expect(report.notReporting).toBe(500);
      expect(report.issues).toHaveLength(500);
    });
  });

  describe('Performance Considerations', () => {
    test('should request appropriate page size for compliance reports', async () => {
      mockAdapter.addMockResponse('GET', '/api/v1/computers-inventory', {
        status: 200,
        data: { results: [] }
      });

      await client.getComplianceReport();

      const request = mockAdapter.getLastRequest();
      expect(request?.params?.['page-size']).toBe(1000);
    });

    test('should complete compliance report within reasonable time', async () => {
      const mockComputers = createMockComputerList(500).map(computer => ({
        ...computer,
        general: { 
          name: computer.name,
          lastContactTime: new Date().toISOString() 
        }
      }));

      mockAdapter.addMockResponse('GET', '/api/v1/computers-inventory', {
        status: 200,
        data: { results: mockComputers }
      });

      const startTime = Date.now();
      await client.getComplianceReport();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});