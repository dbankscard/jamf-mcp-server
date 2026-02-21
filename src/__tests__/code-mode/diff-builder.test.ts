import { describe, expect, it } from '@jest/globals';
import { DiffBuilder } from '../../code-mode/diff-builder.js';

describe('DiffBuilder', () => {
  it('records entries and returns them', () => {
    const diff = new DiffBuilder();
    diff.record('read', 'getAllComputers', [10]);
    diff.record('write', 'createPolicy', [{ name: 'test' }], { id: '1' });

    const entries = diff.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe('read');
    expect(entries[0].method).toBe('getAllComputers');
    expect(entries[1].action).toBe('write');
    expect(entries[1].method).toBe('createPolicy');
  });

  it('computes metrics correctly', () => {
    const diff = new DiffBuilder();
    diff.record('read', 'getAllComputers', [10]);
    diff.record('read', 'listPolicies', []);
    diff.record('write', 'createPolicy', [{ name: 'test' }]);
    diff.record('command', 'executePolicy', ['1', ['d1', 'd2']]);

    const metrics = diff.getMetrics(500);
    expect(metrics.reads).toBe(2);
    expect(metrics.writes).toBe(1);
    expect(metrics.commands).toBe(1);
    expect(metrics.durationMs).toBe(500);
  });

  it('extracts device IDs from single-device methods', () => {
    const diff = new DiffBuilder();
    diff.record('read', 'getComputerDetails', ['device-123']);
    diff.record('command', 'sendComputerMDMCommand', ['device-456', 'RestartDevice']);

    const metrics = diff.getMetrics(100);
    expect(metrics.affectedDeviceCount).toBe(2);
  });

  it('extracts device IDs from multi-device methods', () => {
    const diff = new DiffBuilder();
    diff.record('command', 'executePolicy', ['policy-1', ['d1', 'd2', 'd3']]);

    const metrics = diff.getMetrics(100);
    expect(metrics.affectedDeviceCount).toBe(3);
  });

  it('deduplicates device IDs', () => {
    const diff = new DiffBuilder();
    diff.record('read', 'getComputerDetails', ['device-1']);
    diff.record('command', 'sendComputerMDMCommand', ['device-1', 'RestartDevice']);

    const metrics = diff.getMetrics(100);
    expect(metrics.affectedDeviceCount).toBe(1);
  });

  it('sanitizes long strings in args', () => {
    const longStr = 'a'.repeat(300);
    const diff = new DiffBuilder();
    diff.record('write', 'createScript', [{ name: 'test', script_contents: longStr }]);

    const entries = diff.getEntries();
    const arg = entries[0].args[0] as Record<string, string>;
    expect(arg.script_contents.length).toBeLessThan(300);
    expect(arg.script_contents).toContain('[truncated]');
  });

  it('redacts sensitive fields', () => {
    const diff = new DiffBuilder();
    diff.record('read', 'testApiAccess', [{ password: 'secret123', url: 'https://example.com' }]);

    const entries = diff.getEntries();
    const arg = entries[0].args[0] as Record<string, string>;
    expect(arg.password).toBe('[REDACTED]');
    expect(arg.url).toBe('https://example.com');
  });

  it('does not include result for read entries', () => {
    const diff = new DiffBuilder();
    diff.record('read', 'getAllComputers', [10], [{ id: '1' }]);

    const entries = diff.getEntries();
    expect(entries[0].result).toBeUndefined();
  });

  it('includes result for write entries', () => {
    const diff = new DiffBuilder();
    diff.record('write', 'createPolicy', [{ name: 'test' }], { id: '1' });

    const entries = diff.getEntries();
    expect(entries[0].result).toEqual({ id: '1' });
  });

  it('returns a copy of entries', () => {
    const diff = new DiffBuilder();
    diff.record('read', 'getAllComputers', [10]);

    const entries1 = diff.getEntries();
    const entries2 = diff.getEntries();
    expect(entries1).not.toBe(entries2);
    expect(entries1).toEqual(entries2);
  });
});
