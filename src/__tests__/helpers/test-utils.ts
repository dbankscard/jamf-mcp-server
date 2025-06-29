import { parseJamfDate, formatDateForJamf } from '../../jamf-client-classic';
import { Computer, ComputerDetail } from '../../jamf-client';

// Date testing utilities
export function createTestDates() {
  const now = new Date('2024-12-24T18:27:00.000Z');
  const yesterday = new Date('2024-12-23T18:27:00.000Z');
  const lastWeek = new Date('2024-12-17T18:27:00.000Z');
  const lastMonth = new Date('2024-11-24T18:27:00.000Z');

  return {
    now,
    yesterday,
    lastWeek,
    lastMonth,
    // Jamf date formats
    nowJamfFormat: '2024-12-24 18:27:00',
    nowJamfUTC: '2024-12-24T18:27:00.000+0000',
    nowEpoch: now.getTime(),
    nowEpochSeconds: Math.floor(now.getTime() / 1000)
  };
}

// Test data builders
export class ComputerBuilder {
  private computer: Partial<Computer> = {
    id: '1',
    name: 'Test-Computer',
    udid: '00000000-0000-0000-0000-000000000000',
    serialNumber: 'TEST123456',
    platform: 'Mac'
  };

  withId(id: string): this {
    this.computer.id = id;
    return this;
  }

  withName(name: string): this {
    this.computer.name = name;
    return this;
  }

  withLastContact(date: Date | string): this {
    this.computer.lastContactTime = typeof date === 'string' ? date : date.toISOString();
    return this;
  }

  withIpAddress(ip: string): this {
    this.computer.ipAddress = ip;
    return this;
  }

  withMacAddress(mac: string): this {
    this.computer.macAddress = mac;
    return this;
  }

  withSerialNumber(serialNumber: string): this {
    this.computer.serialNumber = serialNumber;
    return this;
  }

  withOsVersion(version: string): this {
    this.computer.osVersion = version;
    return this;
  }

  withUserApprovedMdm(approved: boolean): this {
    this.computer.userApprovedMdm = approved;
    return this;
  }

  build(): Computer {
    return this.computer as Computer;
  }
}

// Test assertions for date handling
export function assertValidJamfDate(dateValue: any, expectedDate?: Date) {
  const parsed = parseJamfDate(dateValue);
  expect(parsed).toBeTruthy();
  expect(parsed).toBeInstanceOf(Date);
  
  if (expectedDate) {
    expect(parsed?.getTime()).toBe(expectedDate.getTime());
  }
}

export function assertDateFormatsMatch(
  standardFormat: string,
  utcFormat: string,
  epochFormat: number
) {
  const standardParsed = parseJamfDate(standardFormat);
  const utcParsed = parseJamfDate(utcFormat);
  const epochParsed = parseJamfDate(epochFormat);

  expect(standardParsed).toBeTruthy();
  expect(utcParsed).toBeTruthy();
  expect(epochParsed).toBeTruthy();

  // All three should represent the same time
  expect(standardParsed?.getTime()).toBe(utcParsed?.getTime());
  expect(utcParsed?.getTime()).toBe(epochParsed?.getTime());
}

// Wait utilities for async testing
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

// Mock API response generators
export function createMockComputerList(count: number): Computer[] {
  const computers: Computer[] = [];
  const builder = new ComputerBuilder();
  
  for (let i = 1; i <= count; i++) {
    computers.push(
      builder
        .withId(i.toString())
        .withName(`Computer-${i.toString().padStart(3, '0')}`)
        .withSerialNumber(`SN${i.toString().padStart(6, '0')}`)
        .withLastContact(new Date(Date.now() - i * 86400000)) // Each computer last seen i days ago
        .withIpAddress(`192.168.1.${100 + i}`)
        .withMacAddress(`00:11:22:33:44:${(55 + i).toString(16).padStart(2, '0')}`)
        .build()
    );
  }
  
  return computers;
}

// Error testing utilities
export class JamfApiError extends Error {
  constructor(
    public httpStatus: number,
    public code: string,
    public description: string
  ) {
    super(description);
    this.name = 'JamfApiError';
  }
}

export function createApiError(status: number, code: string, description: string) {
  return {
    response: {
      status,
      data: {
        httpStatus: status,
        errors: [
          {
            code,
            description,
            id: '0',
            field: null
          }
        ]
      }
    }
  };
}

// Environment setup helpers
export function setupTestEnvironment() {
  // Save original env vars
  const originalEnv = { ...process.env };
  
  // Set test env vars
  process.env.JAMF_URL = 'https://test.jamfcloud.com';
  process.env.JAMF_USERNAME = 'testuser';
  process.env.JAMF_PASSWORD = 'testpass';
  
  return {
    cleanup: () => {
      // Restore original env vars
      process.env = originalEnv;
    }
  };
}

// Custom matchers for Jamf-specific assertions
export const jamfMatchers = {
  toBeValidJamfDate(received: any) {
    const parsed = parseJamfDate(received);
    const pass = parsed !== null && parsed instanceof Date && !isNaN(parsed.getTime());
    
    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to be a valid Jamf date`
        : `Expected ${received} to be a valid Jamf date`
    };
  },
  
  toMatchJamfComputer(received: any, expected: Partial<Computer>) {
    const mismatches: string[] = [];
    
    for (const [key, value] of Object.entries(expected)) {
      if (received[key] !== value) {
        mismatches.push(`${key}: expected ${value}, got ${received[key]}`);
      }
    }
    
    const pass = mismatches.length === 0;
    
    return {
      pass,
      message: () => pass
        ? `Expected computer not to match`
        : `Expected computer to match:\n${mismatches.join('\n')}`
    };
  }
};

// TypeScript declaration for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidJamfDate(): R;
      toMatchJamfComputer(expected: Partial<Computer>): R;
    }
  }
}