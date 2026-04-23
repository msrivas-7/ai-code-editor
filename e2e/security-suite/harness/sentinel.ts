// Host observer for security-suite scenarios. Three signals:
//
//  1. CANARY — a 500 ms setInterval writes a sequence number to memory.
//     If the tick-to-tick gap ever exceeds 1 s during an attack window,
//     the host-side Node event loop stalled — fork bombs, CPU pinning,
//     or memory pressure leaking to the host trip this. Counts as a
//     "canary miss" per dropped tick.
//
//  2. LOADAVG — sample `/proc/loadavg` on a slower cadence (2 s). The
//     1-minute loadavg is a lagging indicator but catches sustained
//     host CPU consumption that doesn't stall Node's single-thread loop.
//     We record max delta from pre-attack baseline.
//
//  3. EGRESS — on Linux, if we can exec `tcpdump` with sudo, we spawn it
//     listening on the docker bridge for packets originating from the
//     runner subnet. `network=none` means this MUST be zero. When
//     tcpdump isn't available (local dev, restricted CI image), this
//     field is null and scenarios fall back to the backend-level assert
//     only — we note the missing signal in output.
//
// Zero external deps. No daemon, no IPC — one process, one class.

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";

import type { SentinelWindow } from "./types.js";

const CANARY_INTERVAL_MS = 500;
const CANARY_STALL_THRESHOLD_MS = 1000; // miss = tick > this long since previous
const LOADAVG_INTERVAL_MS = 2000;

interface CanaryTick {
  at: number;
  delta: number;
}

export class HostSentinel {
  private canaryTimer: NodeJS.Timeout | null = null;
  private canaryTicks: CanaryTick[] = [];
  private lastCanaryAt = 0;

  private loadavgTimer: NodeJS.Timeout | null = null;
  private loadavgSamples: { at: number; val: number }[] = [];

  private tcpdump: ChildProcess | null = null;
  private tcpdumpPackets: { at: number }[] = [];
  private tcpdumpAvailable: boolean | null = null; // null until start() settles

  private running = false;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.canaryTicks = [];
    this.loadavgSamples = [];
    this.tcpdumpPackets = [];
    this.lastCanaryAt = Date.now();
    this.canaryTimer = setInterval(() => {
      const now = Date.now();
      const delta = now - this.lastCanaryAt;
      this.canaryTicks.push({ at: now, delta });
      this.lastCanaryAt = now;
    }, CANARY_INTERVAL_MS);
    this.canaryTimer.unref();

    this.loadavgTimer = setInterval(async () => {
      const val = await readLoadavg1m();
      if (val !== null) this.loadavgSamples.push({ at: Date.now(), val });
    }, LOADAVG_INTERVAL_MS);
    this.loadavgTimer.unref();

    await this.tryStartTcpdump();
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.canaryTimer) clearInterval(this.canaryTimer);
    if (this.loadavgTimer) clearInterval(this.loadavgTimer);
    this.canaryTimer = null;
    this.loadavgTimer = null;
    if (this.tcpdump) {
      this.tcpdump.kill("SIGTERM");
      this.tcpdump = null;
    }
  }

  /**
   * Open a measurement window, run the provided async attack function,
   * close the window, and return what was observed. Scenarios typically
   * bracket a single `runAttack()` call inside `during`.
   */
  async window(during: () => Promise<void>): Promise<SentinelWindow> {
    const startedAt = Date.now();
    const baselineLoadavg = (await readLoadavg1m()) ?? 0;
    const packetCountAtStart = this.tcpdumpPackets.length;
    const tickCountAtStart = this.canaryTicks.length;

    await during();

    const endedAt = Date.now();
    const ticksInWindow = this.canaryTicks.slice(tickCountAtStart);
    const canaryMisses = ticksInWindow.filter(
      (t) => t.delta > CANARY_STALL_THRESHOLD_MS,
    ).length;
    const loadavgsInWindow = this.loadavgSamples.filter(
      (s) => s.at >= startedAt && s.at <= endedAt,
    );
    const maxLoadavg = loadavgsInWindow.reduce(
      (m, s) => (s.val > m ? s.val : m),
      baselineLoadavg,
    );
    const maxLoadavgDelta = Math.max(0, maxLoadavg - baselineLoadavg);
    const egressPackets = this.tcpdumpAvailable
      ? this.tcpdumpPackets.length - packetCountAtStart
      : null;
    return { startedAt, endedAt, canaryMisses, maxLoadavgDelta, egressPackets };
  }

  get isTcpdumpActive(): boolean {
    return this.tcpdumpAvailable === true;
  }

  private async tryStartTcpdump(): Promise<void> {
    if (process.platform !== "linux") {
      this.tcpdumpAvailable = false;
      return;
    }
    // We listen on the docker0 bridge (or whichever bridge the compose
    // stack uses) for any IP packet. False positives from unrelated
    // containers are acceptable — scenarios assert "packet count
    // increased during my window," not absolute counts.
    const iface = process.env.SECURITY_SUITE_BRIDGE_IFACE ?? "docker0";
    const args = ["-i", iface, "-p", "-n", "-l", "-q", "ip"];
    let cmd = "tcpdump";
    // If we're not root on the CI runner, `sudo -n` runs non-interactively
    // and fails fast when sudoers doesn't allow it — rather than hang.
    if (process.getuid && process.getuid() !== 0) {
      args.unshift(cmd);
      args.unshift("-n");
      cmd = "sudo";
    }
    try {
      this.tcpdump = spawn(cmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      this.tcpdumpAvailable = false;
      this.tcpdump = null;
      return;
    }
    let settled = false;
    const settle = (ok: boolean) => {
      if (!settled) {
        settled = true;
        this.tcpdumpAvailable = ok;
      }
    };
    this.tcpdump.stdout?.on("data", (b: Buffer) => {
      // Once we see any line, tcpdump is definitely up.
      settle(true);
      // Each line is one packet (mostly — `-q` enforces brevity).
      const lines = b.toString().split("\n").filter((l) => l.trim().length > 0);
      for (const _ of lines) this.tcpdumpPackets.push({ at: Date.now() });
    });
    this.tcpdump.stderr?.on("data", () => {
      // Some stderr is fine ("listening on docker0..."). We only care that
      // the process stayed up.
    });
    this.tcpdump.on("exit", () => {
      settle(false);
      this.tcpdump = null;
    });
    // Give tcpdump ~500 ms to either start emitting or exit. If neither,
    // assume it's listening quietly (idle bridge) and count it as available.
    await new Promise((r) => setTimeout(r, 500));
    if (!settled) settle(this.tcpdump !== null);
  }
}

async function readLoadavg1m(): Promise<number | null> {
  try {
    const raw = await fs.readFile("/proc/loadavg", "utf8");
    const first = raw.split(/\s+/)[0];
    const v = Number.parseFloat(first);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
