import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { LRUCache } from '../../utils/lru-cache.js';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>({ maxSize: 3 });
  });

  test('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBeUndefined();
  });

  test('should evict least recently used items when full', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // Should evict key1
    
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  test('should update LRU order on get', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    // Access key1 to make it most recently used
    cache.get('key1');
    
    // Add key4, should evict key2 (least recently used)
    cache.set('key4', 'value4');
    
    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBeUndefined();
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  test('should handle TTL expiration', async () => {
    const ttlCache = new LRUCache<string>({ 
      maxSize: 10, 
      maxAge: 100 // 100ms TTL
    });
    
    ttlCache.set('key1', 'value1');
    expect(ttlCache.get('key1')).toBe('value1');
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(ttlCache.get('key1')).toBeUndefined();
  });

  test('should call onEvict callback', () => {
    const onEvict = jest.fn();
    const evictCache = new LRUCache<string>({ 
      maxSize: 2, 
      onEvict 
    });
    
    evictCache.set('key1', 'value1');
    evictCache.set('key2', 'value2');
    evictCache.set('key3', 'value3'); // Should evict key1
    
    expect(onEvict).toHaveBeenCalledWith('key1', 'value1');
  });

  test('should handle delete operation', () => {
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);
    
    const deleted = cache.delete('key1');
    expect(deleted).toBe(true);
    expect(cache.has('key1')).toBe(false);
    expect(cache.get('key1')).toBeUndefined();
  });

  test('should clear all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    cache.clear();
    
    expect(cache.size).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBeUndefined();
  });

  test('should clean expired entries', async () => {
    const ttlCache = new LRUCache<string>({ 
      maxSize: 10, 
      maxAge: 100 
    });
    
    ttlCache.set('key1', 'value1');
    ttlCache.set('key2', 'value2');
    
    // Wait for key1 to expire
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Add key3 to trigger some activity
    ttlCache.set('key3', 'value3');
    
    // Clean expired entries
    ttlCache.cleanExpired();
    
    expect(ttlCache.has('key1')).toBe(false);
    expect(ttlCache.has('key2')).toBe(false);
    expect(ttlCache.has('key3')).toBe(true);
  });

  test('should provide accurate statistics', () => {
    const statsCache = new LRUCache<string>({ maxSize: 5 });
    
    statsCache.set('key1', 'value1');
    statsCache.set('key2', 'value2');
    statsCache.set('key3', 'value3');
    
    const stats = statsCache.getStats();
    expect(stats.size).toBe(3);
    expect(stats.maxSize).toBe(5);
    expect(stats.utilization).toBe(0.6);
  });
});