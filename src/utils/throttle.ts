/**
 * Semaphore-style concurrency limiter.
 * Limits the number of in-flight async operations to prevent 429 rate-limit errors.
 */

const DEFAULT_MAX_CONCURRENCY = 5;

export class ConcurrencyLimiter {
  private readonly maxConcurrency: number;
  private running = 0;
  private readonly queue: Array<() => void> = [];

  constructor(maxConcurrency?: number) {
    const envVal = process.env.JAMF_MAX_CONCURRENCY;
    this.maxConcurrency =
      maxConcurrency ?? (envVal ? parseInt(envVal, 10) || DEFAULT_MAX_CONCURRENCY : DEFAULT_MAX_CONCURRENCY);
  }

  /** Execute `fn` once a concurrency slot is available. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Throttled replacement for `Promise.allSettled(items.map(fn))`.
   * Processes all items with bounded concurrency and returns settled results.
   */
  async mapSettled<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
  ): Promise<PromiseSettledResult<R>[]> {
    return Promise.allSettled(items.map((item) => this.run(() => fn(item))));
  }

  private acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.running--;
    }
  }
}
