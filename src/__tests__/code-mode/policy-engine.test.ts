import { describe, expect, it } from '@jest/globals';
import {
  checkAccess,
  getClassification,
  getMethodPolicy,
  BudgetTracker,
  requiresApproval,
  getAllMethodNames,
} from '../../code-mode/policy-engine.js';

describe('PolicyEngine', () => {
  describe('getMethodPolicy', () => {
    it('returns policy for known methods', () => {
      const policy = getMethodPolicy('getAllComputers');
      expect(policy).toEqual({ classification: 'read', capability: 'read:computers' });
    });

    it('returns undefined for unknown methods', () => {
      expect(getMethodPolicy('nonExistentMethod')).toBeUndefined();
    });
  });

  describe('checkAccess', () => {
    it('allows access when capability is granted', () => {
      const result = checkAccess('getAllComputers', ['read:computers']);
      expect(result.allowed).toBe(true);
    });

    it('denies access when capability is not granted', () => {
      const result = checkAccess('getAllComputers', ['read:policies']);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('read:computers');
    });

    it('denies access for unknown methods', () => {
      const result = checkAccess('bogus', ['read:computers']);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown method');
    });

    it('allows write methods with write capability', () => {
      const result = checkAccess('createPolicy', ['write:policies']);
      expect(result.allowed).toBe(true);
    });

    it('denies write methods with only read capability', () => {
      const result = checkAccess('createPolicy', ['read:policies']);
      expect(result.allowed).toBe(false);
    });
  });

  describe('getClassification', () => {
    it('classifies read methods', () => {
      expect(getClassification('getAllComputers')).toBe('read');
      expect(getClassification('listPolicies')).toBe('read');
      expect(getClassification('searchScripts')).toBe('read');
    });

    it('classifies write methods', () => {
      expect(getClassification('createPolicy')).toBe('write');
      expect(getClassification('updateScript')).toBe('write');
      expect(getClassification('deletePolicy')).toBe('write');
    });

    it('classifies command methods', () => {
      expect(getClassification('executePolicy')).toBe('command');
      expect(getClassification('sendComputerMDMCommand')).toBe('command');
      expect(getClassification('flushMDMCommands')).toBe('command');
      expect(getClassification('updateInventory')).toBe('command');
    });

    it('returns undefined for unknown methods', () => {
      expect(getClassification('bogus')).toBeUndefined();
    });
  });

  describe('BudgetTracker', () => {
    it('allows calls within budget', () => {
      const tracker = new BudgetTracker({ reads: 3, writes: 2, commands: 1 });
      expect(tracker.trackCall('getAllComputers').allowed).toBe(true);
      expect(tracker.trackCall('listPolicies').allowed).toBe(true);
      expect(tracker.trackCall('searchScripts').allowed).toBe(true);
    });

    it('denies calls when budget exhausted', () => {
      const tracker = new BudgetTracker({ reads: 1, writes: 1, commands: 1 });
      expect(tracker.trackCall('getAllComputers').allowed).toBe(true);
      const result = tracker.trackCall('listPolicies');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('budget exhausted');
    });

    it('tracks separate buckets', () => {
      const tracker = new BudgetTracker({ reads: 1, writes: 1, commands: 1 });
      expect(tracker.trackCall('getAllComputers').allowed).toBe(true);  // read
      expect(tracker.trackCall('createPolicy').allowed).toBe(true);     // write
      expect(tracker.trackCall('executePolicy').allowed).toBe(true);    // command
      // Now all exhausted
      expect(tracker.trackCall('listPolicies').allowed).toBe(false);
      expect(tracker.trackCall('updatePolicy').allowed).toBe(false);
      expect(tracker.trackCall('deployScript').allowed).toBe(false);
    });

    it('reports counts', () => {
      const tracker = new BudgetTracker({ reads: 10, writes: 10, commands: 10 });
      tracker.trackCall('getAllComputers');
      tracker.trackCall('listPolicies');
      tracker.trackCall('createPolicy');
      expect(tracker.getCounts()).toEqual({ reads: 2, writes: 1, commands: 0 });
    });
  });

  describe('requiresApproval', () => {
    it('requires approval for high-impact methods', () => {
      expect(requiresApproval('executePolicy')).toBe(true);
      expect(requiresApproval('sendComputerMDMCommand')).toBe(true);
      expect(requiresApproval('flushMDMCommands')).toBe(true);
      expect(requiresApproval('deployScript')).toBe(true);
    });

    it('does not require approval for regular methods', () => {
      expect(requiresApproval('getAllComputers')).toBe(false);
      expect(requiresApproval('createPolicy')).toBe(false);
      expect(requiresApproval('deleteScript')).toBe(false);
    });
  });

  describe('getAllMethodNames', () => {
    it('returns all method names', () => {
      const names = getAllMethodNames();
      expect(names.length).toBeGreaterThan(100);
      expect(names).toContain('getAllComputers');
      expect(names).toContain('createPolicy');
      expect(names).toContain('executePolicy');
    });
  });
});
