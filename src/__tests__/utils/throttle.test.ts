import { ConcurrencyLimiter } from '../../utils/throttle.js';

describe('ConcurrencyLimiter', () => {
  it('limits concurrent executions to maxConcurrency', async () => {
    const limiter = new ConcurrencyLimiter(2);
    let running = 0;
    let maxRunning = 0;

    const task = () =>
      limiter.run(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        // Yield to let other tasks try to start
        await new Promise((r) => setTimeout(r, 20));
        running--;
        return maxRunning;
      });

    await Promise.all([task(), task(), task(), task(), task()]);

    expect(maxRunning).toBe(2);
  });

  it('drains the full queue', async () => {
    const limiter = new ConcurrencyLimiter(2);
    const results: number[] = [];

    const tasks = Array.from({ length: 6 }, (_, i) =>
      limiter.run(async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(i);
        return i;
      }),
    );

    const values = await Promise.all(tasks);

    expect(values).toEqual([0, 1, 2, 3, 4, 5]);
    expect(results).toHaveLength(6);
  });

  it('propagates errors without deadlocking', async () => {
    const limiter = new ConcurrencyLimiter(2);

    const successTask = limiter.run(async () => 'ok');
    const failTask = limiter.run(async () => {
      throw new Error('boom');
    });
    const afterTask = limiter.run(async () => 'after');

    await expect(failTask).rejects.toThrow('boom');
    expect(await successTask).toBe('ok');
    expect(await afterTask).toBe('after');
  });

  describe('mapSettled', () => {
    it('returns fulfilled and rejected results', async () => {
      const limiter = new ConcurrencyLimiter(3);

      const results = await limiter.mapSettled(
        [1, 2, 3, 4],
        async (n) => {
          if (n === 3) throw new Error('bad');
          return n * 10;
        },
      );

      expect(results).toHaveLength(4);
      expect(results[0]).toEqual({ status: 'fulfilled', value: 10 });
      expect(results[1]).toEqual({ status: 'fulfilled', value: 20 });
      expect(results[2]).toMatchObject({ status: 'rejected' });
      expect((results[2] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
      expect(results[3]).toEqual({ status: 'fulfilled', value: 40 });
    });

    it('respects concurrency limit', async () => {
      const limiter = new ConcurrencyLimiter(2);
      let running = 0;
      let maxRunning = 0;

      await limiter.mapSettled([1, 2, 3, 4, 5], async (n) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 15));
        running--;
        return n;
      });

      expect(maxRunning).toBe(2);
    });
  });
});
