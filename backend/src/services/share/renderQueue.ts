// Phase 21C (post-audit): bounded concurrency around the Satori +
// resvg render path. Both libraries are CPU-bound (Satori does
// layout in JS, resvg rasterizes via a sync C++ call) and either
// will pin the event loop while running. On a 2vCPU prod box, 4
// parallel renders means a request burst that takes 600ms each
// blocks every other request (lesson loads, AI calls, run/check
// flows) for that whole window.
//
// p-limit(2) caps concurrent renders to two — slightly less than
// vCPU count — so the event loop still has cycles for the rest of
// the API. Renders queue cooperatively via a tiny FIFO. Imported
// in routes/shares.ts and applied to BOTH the OG and Story
// pipelines (each pipeline counts as one slot, so a single share
// creation can use both slots and still leave 0 capacity for a
// concurrent share — that's acceptable since it just queues).
//
// No external dep — the implementation is small enough to inline,
// and avoiding `p-limit` keeps the backend container slim.

const MAX_CONCURRENT = 2;
let active = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<() => void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return release;
  }
  return new Promise<() => void>((resolve) => {
    waiters.push(() => {
      active += 1;
      resolve(release);
    });
  });
}

function release(): void {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

/**
 * Run `fn` under the render semaphore. Acquires before invocation,
 * releases on resolve OR reject so a thrown render doesn't leak the
 * slot.
 */
export async function withRenderSlot<T>(fn: () => Promise<T>): Promise<T> {
  const releaseSlot = await acquire();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

/** Test-only: assertion helper. */
export function _renderQueueDepth(): { active: number; waiting: number } {
  return { active, waiting: waiters.length };
}
