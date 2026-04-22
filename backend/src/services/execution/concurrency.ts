// Phase 20-P3: FIFO semaphore for capping concurrent work. Used to bound
// how many `docker exec` calls can be in flight across the backend process
// — dockerode doesn't queue under load, it happily fires N parallel execs
// that all stall on the socket while each spikes CPU + IO. This primitive
// is queue-with-bounded-runners: up to `maxConcurrent` runners at once;
// everyone else waits in arrival order so there's no starvation.

export interface Semaphore {
  run<T>(fn: () => Promise<T>): Promise<T>;
  readonly inFlight: number;
  readonly waiting: number;
}

export function createSemaphore(maxConcurrent: number): Semaphore {
  if (maxConcurrent < 1 || !Number.isInteger(maxConcurrent)) {
    throw new Error(
      `[semaphore] maxConcurrent must be a positive integer (got ${maxConcurrent})`,
    );
  }
  let active = 0;
  const queue: Array<() => void> = [];

  const release = () => {
    active--;
    const next = queue.shift();
    if (next) next();
  };

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (active >= maxConcurrent) {
        await new Promise<void>((resolve) => queue.push(resolve));
      }
      active++;
      try {
        return await fn();
      } finally {
        release();
      }
    },
    get inFlight() {
      return active;
    },
    get waiting() {
      return queue.length;
    },
  };
}
