import { describe, expect, it, vi } from "vitest";
import { createSemaphore } from "./concurrency.js";

describe("createSemaphore", () => {
  it("caps in-flight runners at maxConcurrent", async () => {
    const sem = createSemaphore(2);
    let peak = 0;
    let active = 0;
    const task = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
    };
    await Promise.all([
      sem.run(task),
      sem.run(task),
      sem.run(task),
      sem.run(task),
      sem.run(task),
    ]);
    expect(peak).toBe(2);
  });

  it("preserves FIFO order for queued waiters", async () => {
    const sem = createSemaphore(1);
    const order: number[] = [];
    const make = (id: number) => async () => {
      order.push(id);
      await new Promise((r) => setTimeout(r, 5));
    };
    await Promise.all([
      sem.run(make(1)),
      sem.run(make(2)),
      sem.run(make(3)),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("releases the slot on thrown rejections", async () => {
    const sem = createSemaphore(1);
    await expect(
      sem.run(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(sem.inFlight).toBe(0);
    // A subsequent caller must be able to acquire — without the finally
    // release path this would deadlock.
    const fn = vi.fn(async () => "ok");
    await expect(sem.run(fn)).resolves.toBe("ok");
  });

  it("throws on non-positive or non-integer maxConcurrent", () => {
    expect(() => createSemaphore(0)).toThrow();
    expect(() => createSemaphore(-1)).toThrow();
    expect(() => createSemaphore(1.5)).toThrow();
  });
});
