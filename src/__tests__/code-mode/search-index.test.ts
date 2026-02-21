import { describe, expect, it } from '@jest/globals';
import { search, getAllEntries, getCategories } from '../../code-mode/search-index.js';

describe('SearchIndex', () => {
  describe('getAllEntries', () => {
    it('returns all catalog entries', () => {
      const entries = getAllEntries();
      // 111 API methods + 3 helpers
      expect(entries.length).toBeGreaterThan(100);
    });

    it('includes helper entries', () => {
      const entries = getAllEntries();
      const helpers = entries.filter(e => e.category === 'helpers');
      expect(helpers.length).toBe(3);
      expect(helpers.map(h => h.name)).toContain('helpers.paginate');
      expect(helpers.map(h => h.name)).toContain('helpers.daysSince');
      expect(helpers.map(h => h.name)).toContain('helpers.chunk');
    });
  });

  describe('getCategories', () => {
    it('returns all unique categories', () => {
      const cats = getCategories();
      expect(cats).toContain('computers');
      expect(cats).toContain('policies');
      expect(cats).toContain('scripts');
      expect(cats).toContain('reports');
      expect(cats).toContain('helpers');
    });
  });

  describe('search', () => {
    it('returns all entries for empty query', () => {
      const results = search('');
      expect(results.length).toBe(getAllEntries().length);
    });

    it('finds methods by name', () => {
      const results = search('getAllComputers');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('getAllComputers');
    });

    it('finds methods by category', () => {
      const results = search('policies');
      expect(results.length).toBeGreaterThan(5);
      expect(results.every(r =>
        r.name.toLowerCase().includes('polic') ||
        r.category === 'policies' ||
        r.description.toLowerCase().includes('polic'),
      )).toBe(true);
    });

    it('finds methods by description keywords', () => {
      const results = search('serial number');
      expect(results.length).toBeGreaterThan(0);
    });

    it('ranks exact name matches highest', () => {
      const results = search('listPolicies');
      expect(results[0].name).toBe('listPolicies');
    });

    it('handles multi-word queries', () => {
      const results = search('computer group');
      expect(results.length).toBeGreaterThan(0);
    });

    it('finds helper functions', () => {
      const results = search('paginate');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('helpers.paginate');
    });
  });
});
