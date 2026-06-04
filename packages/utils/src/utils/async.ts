/**
 * Async utilities for Organic Interface
 */

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export interface RetryOptions {
  /** Maximum number of attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier */
  multiplier?: number;
  /** Whether to jitter the delay */
  jitter?: boolean;
  /** Callback on retry */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    multiplier = 2,
    jitter = true,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Calculate delay
      let delay = Math.min(initialDelay * Math.pow(multiplier, attempt - 1), maxDelay);

      // Add jitter
      if (jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Timeout wrapper for promises
 */
export interface TimeoutOptions {
  /** Timeout in milliseconds */
  timeout: number;
  /** Error message on timeout */
  message?: string;
}

/**
 * Execute a function with a timeout
 */
export async function withTimeout<T>(promise: Promise<T>, options: TimeoutOptions): Promise<T> {
  const { timeout, message = 'Operation timed out' } = options;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), timeout)),
  ]);
}

/**
 * Execute multiple promises with concurrency limit
 */
export async function withConcurrencyLimit<T>(
  promises: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const promise of promises) {
    const p = promise().then(result => {
      results.push(result);
    });

    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(e => e === p),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Async queue for serial execution
 */
export class AsyncQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  /**
   * Add an async operation to the queue
   */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.isProcessing) {
        this.process();
      }
    });
  }

  private async process(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const fn = this.queue.shift()!;
    await fn();
    await this.process();
  }
}
